#!/bin/bash

# Add document start marker and fix newlines
for file in *.yaml; do
  # Add --- if not present
  if ! grep -q "^---" "$file"; then
    sed -i '1i---' "$file"
  fi
  
  # Ensure single newline at end of file and remove trailing spaces
  sed -i -e :a -e '/^\n*$/{$d;N;ba' -e '}' "$file"
  sed -i 's/[[:space:]]*$//' "$file"
  echo >> "$file"
done

# Fix indentation
sed -i 's/^      /  /g' *.yaml
sed -i 's/^    /  /g' *.yaml 