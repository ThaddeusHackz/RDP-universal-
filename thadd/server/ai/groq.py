"""THADD OS — Groq (and any OpenAI-compatible) chat client.

Pure standard library: ``urllib`` + manual SSE parsing, so nothing has to be
installed inside the live ISO for the AI to work.  Streaming, tool-calling and
model discovery are all supported.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Callable, Iterable

DEFAULT_BASE = "https://api.groq.com/openai/v1"

GROQ_MODELS = [
    {"id": "llama-3.3-70b-versatile", "label": "Llama 3.3 70B Versatile", "ctx": 131072, "tier": "flagship"},
    {"id": "llama-3.1-8b-instant", "label": "Llama 3.1 8B Instant", "ctx": 131072, "tier": "fast"},
    {"id": "openai/gpt-oss-120b", "label": "GPT-OSS 120B (Groq)", "ctx": 131072, "tier": "flagship"},
    {"id": "openai/gpt-oss-20b", "label": "GPT-OSS 20B (Groq)", "ctx": 131072, "tier": "balanced"},
    {"id": "moonshotai/kimi-k2-instruct", "label": "Kimi K2 Instruct", "ctx": 131072, "tier": "flagship"},
    {"id": "deepseek-r1-distill-llama-70b", "label": "DeepSeek R1 Distill 70B", "ctx": 131072, "tier": "reasoning"},
    {"id": "qwen/qwen3-32b", "label": "Qwen3 32B", "ctx": 131072, "tier": "balanced"},
    {"id": "meta-llama/llama-4-scout-17b-16e-instruct", "label": "Llama 4 Scout 17B", "ctx": 131072, "tier": "balanced"},
    {"id": "meta-llama/llama-4-maverick-17b-128e-instruct", "label": "Llama 4 Maverick 17B", "ctx": 131072, "tier": "flagship"},
    {"id": "gemma2-9b-it", "label": "Gemma 2 9B", "ctx": 8192, "tier": "fast"},
]


class GroqError(Exception):
    def __init__(self, message: str, status: int = 0, body: str = ""):
        super().__init__(message)
        self.status = status
        self.body = body


class GroqClient:
    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE, timeout: float = 120.0):
        self.api_key = (api_key or "").strip()
        self.base_url = (base_url or DEFAULT_BASE).rstrip("/")
        self.timeout = timeout

    # ------------------------------------------------------------------ transport
    def _request(self, path: str, payload: dict | None = None, method: str = "POST"):
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {self.api_key}")
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", "THADD-OS/1.0")
        try:
            return urllib.request.urlopen(req, timeout=self.timeout)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")[:4000]
            detail = body
            try:
                parsed = json.loads(body)
                detail = parsed.get("error", {}).get("message", body)
            except Exception:
                pass
            raise GroqError(f"Groq API error {exc.code}: {detail}", exc.code, body) from None
        except urllib.error.URLError as exc:
            raise GroqError(f"network error talking to Groq: {exc.reason}", 0, "") from None

    # -------------------------------------------------------------------- helpers
    def models(self) -> list[dict]:
        """Live model list from the provider, with a curated fallback."""
        try:
            with self._request("/models", None, "GET") as resp:
                data = json.loads(resp.read().decode())
            live = [
                {"id": m.get("id", ""), "label": m.get("id", ""), "ctx": m.get("context_window") or 131072,
                 "tier": "live", "owned_by": m.get("owned_by", "")}
                for m in data.get("data", [])
                if m.get("id") and "whisper" not in m["id"] and "tts" not in m["id"] and "guard" not in m["id"]
            ]
            if live:
                curated = {m["id"]: m for m in GROQ_MODELS}
                for m in live:
                    if m["id"] in curated:
                        m.update({k: v for k, v in curated[m["id"]].items() if k in ("label", "tier")})
                live.sort(key=lambda m: (m["tier"] != "flagship", m["label"]))
                return live
        except GroqError:
            pass
        return list(GROQ_MODELS)

    def ping(self) -> dict:
        """Cheap round-trip used by the settings page to validate the API key."""
        started = time.time()
        try:
            models = self.models()
            return {"ok": True, "latency_ms": int((time.time() - started) * 1000), "models": len(models)}
        except GroqError as exc:
            return {"ok": False, "error": str(exc), "status": exc.status}

    # --------------------------------------------------------------------- chat
    def chat(self, messages: list[dict], tools: list[dict] | None = None, model: str = "llama-3.3-70b-versatile",
             temperature: float = 0.4, max_tokens: int = 2048, stream: bool = False,
             on_token: Callable[[str], None] | None = None, stop: Callable[[], bool] | None = None) -> dict:
        """Run one chat completion.  Returns the assistant message (dict).

        When ``stream`` is set, ``on_token`` receives incremental text so the UI
        can render the answer as it is produced.
        """
        payload: dict = {
            "model": model,
            "messages": messages,
            "temperature": max(0.0, min(float(temperature), 2.0)),
            "max_tokens": max(64, min(int(max_tokens), 32768)),
            "stream": bool(stream),
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        if not self.api_key:
            raise GroqError("no Groq API key configured", 401, "")

        resp = self._request("/chat/completions", payload)
        if not stream:
            data = json.loads(resp.read().decode())
            choice = (data.get("choices") or [{}])[0]
            msg = choice.get("message", {}) or {}
            msg["_usage"] = data.get("usage", {})
            msg["_model"] = data.get("model", model)
            return msg

        content_parts: list[str] = []
        tool_calls: dict[int, dict] = {}
        usage: dict = {}
        model_used = model
        for event in _iter_sse(resp):
            if stop and stop():
                break
            if event == "[DONE]":
                break
            try:
                chunk = json.loads(event)
            except json.JSONDecodeError:
                continue
            model_used = chunk.get("model", model_used)
            if chunk.get("usage"):
                usage = chunk["usage"]
            for choice in chunk.get("choices", []):
                delta = choice.get("delta", {}) or {}
                piece = delta.get("content")
                if piece:
                    content_parts.append(piece)
                    if on_token:
                        on_token(piece)
                for tc in delta.get("tool_calls", []) or []:
                    idx = tc.get("index", 0)
                    slot = tool_calls.setdefault(idx, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                    if tc.get("id"):
                        slot["id"] = tc["id"]
                    fn = tc.get("function", {}) or {}
                    if fn.get("name"):
                        slot["function"]["name"] = fn["name"]
                    if fn.get("arguments"):
                        slot["function"]["arguments"] += fn["arguments"]
        msg = {"role": "assistant", "content": "".join(content_parts)}
        if tool_calls:
            msg["tool_calls"] = [tool_calls[i] for i in sorted(tool_calls)]
        msg["_usage"] = usage
        msg["_model"] = model_used
        return msg


def _iter_sse(resp) -> Iterable[str]:
    """Yield ``data:`` payloads from a Server-Sent-Events HTTP response."""
    buf = b""
    while True:
        chunk = resp.read(1)
        if not chunk:
            break
        buf += chunk
        while b"\n" in buf:
            line, buf = buf.split(b"\n", 1)
            line = line.strip()
            if not line or line.startswith(b":"):
                continue
            if line.startswith(b"data:"):
                payload = line[5:].strip()
                if payload:
                    yield payload.decode("utf-8", "replace")
