#!/bin/bash
set -e
VERSION=$1
CHANGELOG=$2
if [ -z "$VERSION" ] || [ -z "$CHANGELOG" ]; then
    echo "Usage: ./scripts/release.sh <version> <changelog-message>"
    exit 1
fi
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    echo "Version format error"
    exit 1
fi
SEMVER="${VERSION#v}"
echo "Releasing $VERSION"
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$SEMVER\"/" package.json
rm -f package.json.bak
TODAY=$(date +%Y-%m-%d)
TEMP_FILE=$(mktemp)
awk -v ver="$VERSION" -v date="$TODAY" -v msg="$CHANGELOG" '
/^## \[/ {
    if (!inserted) {
        print "## [" ver "] - " date
        print ""
        print "### Changes"
        print ""
        print "- " msg
        print ""
        inserted = 1
    }
}
{ print }
' CHANGELOG.md > "$TEMP_FILE"
mv "$TEMP_FILE" CHANGELOG.md
git add package.json CHANGELOG.md
git commit -m "release: $VERSION - $CHANGELOG"
git tag -a "$VERSION" -m "$CHANGELOG"
git push origin main --tags
echo "Release complete: $VERSION"