#!/usr/bin/env bash
out="$1"
: > "$out"
pass_total=0; fail_total=0; failed_files=""
for f in tests/integration/*.test.ts; do
  res=$(node --import tsx --test --test-concurrency=1 "$f" 2>&1)
  p=$(echo "$res" | grep -E "^# pass |^ℹ pass " | grep -oE "[0-9]+" | tail -1)
  fl=$(echo "$res" | grep -E "^# fail |^ℹ fail " | grep -oE "[0-9]+" | tail -1)
  p=${p:-0}; fl=${fl:-0}
  pass_total=$((pass_total+p)); fail_total=$((fail_total+fl))
  if [ "$fl" != "0" ]; then
    failed_files="$failed_files $f"
    echo "FAIL $f  pass=$p fail=$fl" >> "$out"
    echo "$res" | grep -E "✖|not ok|AssertionError|Error:" | head -12 >> "$out"
  else
    echo "ok   $f  pass=$p" >> "$out"
  fi
done
echo "" >> "$out"
echo "TOTAL pass=$pass_total fail=$fail_total" >> "$out"
echo "FAILED FILES:$failed_files" >> "$out"
