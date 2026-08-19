# ~/.bashrc — THADD OS
# Interactively used only
case $- in
    *i*) ;;
    *) return;;
esac

HISTSIZE=10000
HISTFILESIZE=20000
HISTCONTROL=ignoreboth:erasedups
shopt -s histappend checkwinsize

export EDITOR=nano
export TERM="${TERM:-xterm-256color}"

# --- THADD OS aliases -------------------------------------------------------
alias ls='ls -h --color=auto'
alias ll='ls -alFh'
alias la='ls -Ah'
alias th='thadd'
alias sys='btop'
alias please='sudo'
alias ..='cd ..'
alias ...='cd ../..'
alias ports='ss -tulpn'
alias free='free -h'

# --- prompt: starship if installed, otherwise the branded THADD prompt ------
if command -v starship >/dev/null 2>&1; then
    eval "$(starship init bash)"
else
    PS1='\[\e[1;36m\]\u\[\e[0m\]@\[\e[1;35m\]\h\[\e[0m\] \[\e[90m\]\w\[\e[0m\] \[\e[1;32m\]➜\[\e[0m\] '
fi

# --- greeting ---------------------------------------------------------------
if [ -x /usr/local/bin/thadd ] && [ -z "${THADD_QUIET:-}" ] && [ -t 0 ]; then
    thadd | sed 's/^/  /'
fi
