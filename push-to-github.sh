#!/bin/bash
# استخدام: ./push-to-github.sh https://github.com/USERNAME/REPO.git
set -e
if [ -z "$1" ]; then
  echo "❌ الرجاء تمرير رابط المستودع"
  echo "مثال: ./push-to-github.sh https://github.com/username/halqati.git"
  echo "أو مع توكن: ./push-to-github.sh https://TOKEN@github.com/username/halqati.git"
  exit 1
fi
REPO_URL="$1"
echo "🚀 إضافة remote ورفع المشروع إلى: $REPO_URL"
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git branch -M main
git push -u origin main
echo "✅ تم الرفع بنجاح!"
