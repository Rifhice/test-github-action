git add .
git commit -m "$1"
git push
git tag -a -m "Release $1" $1
git push --follow-tags