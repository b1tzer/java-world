#!/bin/bash
# ============================================================
# 常驻后台 Chrome 管理脚本
#
# 用法:
#   ./persistent-chrome.sh start    启动常驻 Chrome
#   ./persistent-chrome.sh stop     停止常驻 Chrome
#   ./persistent-chrome.sh status   查看运行状态
#   ./persistent-chrome.sh restart  重启
# ============================================================

CHROME_BIN="/data/home/lipingxie/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"
USER_DATA="/tmp/persistent-chrome-profile"
LOG_FILE="/tmp/chrome-persistent.log"
CDP_PORT=9222
PID_FILE="/tmp/chrome-persistent.pid"

start() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "[!] Chrome 已在运行，PID=$(cat $PID_FILE)"
        return 1
    fi

    nohup "$CHROME_BIN" \
        --headless=new \
        --remote-debugging-port=$CDP_PORT \
        --remote-debugging-address=127.0.0.1 \
        --no-first-run \
        --no-default-browser-check \
        --no-sandbox \
        --user-data-dir="$USER_DATA" \
        > "$LOG_FILE" 2>&1 &

    echo $! > "$PID_FILE"
    sleep 2

    if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "✅ Chrome 已启动，PID=$(cat $PID_FILE)，CDP 端口: $CDP_PORT"
    else
        echo "❌ Chrome 启动失败，查看日志: $LOG_FILE"
        rm -f "$PID_FILE"
        return 1
    fi
}

stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo "[!] 没有找到 PID 文件，尝试 killall..."
        pkill -f "chrome.*remote-debugging-port=$CDP_PORT" 2>/dev/null
        return
    fi

    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null
        # 等待进程退出
        for i in $(seq 1 5); do
            kill -0 "$PID" 2>/dev/null || break
            sleep 1
        done
        # 如果还没退出，强制杀
        kill -9 "$PID" 2>/dev/null
        echo "✅ Chrome 已停止，PID=$PID"
    else
        echo "[!] PID $PID 进程不存在"
    fi
    rm -f "$PID_FILE"
}

status() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "✅ Chrome 运行中，PID=$(cat $PID_FILE)，端口: $CDP_PORT"
        echo "   CDP endpoint: http://127.0.0.1:$CDP_PORT"
        echo "   ws: $(curl -s http://127.0.0.1:$CDP_PORT/json/version 2>/dev/null | grep -o '"webSocketDebuggerUrl": "[^"]*"' | cut -d'"' -f4)"
    else
        echo "❌ Chrome 未运行"
    fi
}

case "${1:-status}" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; sleep 1; start ;;
    status)  status ;;
    *)       echo "用法: $0 {start|stop|restart|status}" ;;
esac