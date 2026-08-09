#!/bin/bash
# SVG 编辑器自测脚本
# 使用 agent-browser (Playwright) 自动化测试
# 用法: bash test-svg-editor.sh

set -e

TEST_RESULTS=()
PASS=0
FAIL=0

log_pass() { TEST_RESULTS+=("✅ PASS: $1"); ((PASS++)); echo "✅ PASS: $1"; }
log_fail() { TEST_RESULTS+=("❌ FAIL: $1"); ((FAIL++)); echo "❌ FAIL: $1"; }

# 等待 dev server 启动
echo "⏳ 等待 dev server..."
for i in {1..30}; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ dev server 就绪"
    break
  fi
  sleep 1
done

# 打开编辑器页面
echo "📝 打开 SVG 编辑器..."
agent-browser open "http://localhost:5173/__svg-editor__?src=/diagrams/concurrency-layered-arch.svg" 2>/dev/null
sleep 3

# 获取快照
SNAPSHOT=$(agent-browser snapshot -i 2>/dev/null)

# 测试1: 编辑器是否加载
if echo "$SNAPSHOT" | grep -q "editor-overlay\|editor-panel"; then
  log_pass "编辑器加载"
else
  log_fail "编辑器加载"
fi

# 测试2: 工具栏是否存在
if echo "$SNAPSHOT" | grep -q "editor-toolbar"; then
  log_pass "工具栏渲染"
else
  log_fail "工具栏渲染"
fi

# 测试3: 画布是否渲染
if echo "$SNAPSHOT" | grep -q "canvas"; then
  log_pass "画布渲染"
else
  log_fail "画布渲染"
fi

# 测试4: 检查工具栏按钮
BUTTONS=("撤销" "重做" "复制" "粘贴" "删除" "适应画布" "左对齐" "水平居中" "右对齐" "上移一层" "下移一层" "置顶" "置底" "水平等间距" "垂直等间距")
for btn in "${BUTTONS[@]}"; do
  if echo "$SNAPSHOT" | grep -q "$btn"; then
    log_pass "按钮: $btn"
  else
    log_fail "按钮: $btn"
  fi
done

# 测试5: 检查 P1 功能按钮
P1_BUTTONS=("组合" "取消组合")
for btn in "${P1_BUTTONS[@]}"; do
  if echo "$SNAPSHOT" | grep -q "$btn"; then
    log_pass "P1按钮: $btn"
  else
    log_fail "P1按钮: $btn"
  fi
done

# 测试6: 检查 P2 功能控件
P2_CONTROLS=("透明度" "旋转" "纯色" "阴影")
for ctrl in "${P2_CONTROLS[@]}"; do
  if echo "$SNAPSHOT" | grep -q "$ctrl"; then
    log_pass "P2控件: $ctrl"
  else
    log_fail "P2控件: $ctrl"
  fi
done

# 测试7: 检查文字格式控件
TEXT_CONTROLS=("加粗" "斜体" "下划线")
for ctrl in "${TEXT_CONTROLS[@]}"; do
  if echo "$SNAPSHOT" | grep -q "$ctrl"; then
    log_pass "文字格式: $ctrl"
  else
    log_fail "文字格式: $ctrl"
  fi
done

# 测试8: 检查保存按钮
if echo "$SNAPSHOT" | grep -q "保存"; then
  log_pass "保存按钮"
else
  log_fail "保存按钮"
fi

# 测试9: 检查关闭按钮
if echo "$SNAPSHOT" | grep -q "✕"; then
  log_pass "关闭按钮"
else
  log_fail "关闭按钮"
fi

# 输出结果
echo ""
echo "=========================================="
echo "  测试结果汇总"
echo "=========================================="
echo "  通过: $PASS"
echo "  失败: $FAIL"
echo "  总计: $((PASS + FAIL))"
echo "=========================================="

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "❌ 失败的测试:"
  for result in "${TEST_RESULTS[@]}"; do
    if [[ "$result" == *"❌ FAIL"* ]]; then
      echo "  $result"
    fi
  done
  exit 1
else
  echo ""
  echo "🎉 全部测试通过！"
  exit 0
fi
