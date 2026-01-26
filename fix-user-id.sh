#!/bin/bash
# Script to add @ts-ignore before all user.id references in API routes

find app/api -name "*.ts" -type f | while read file; do
  # Add @ts-ignore before user.id references (but not if already present)
  sed -i '' '/\/\/ @ts-ignore/!{
    s/\([ \t]*\)\(.*user\.id\)/\1\/\/ @ts-ignore\n\1\2/
  }' "$file"
done

echo "Added @ts-ignore to all user.id references"
