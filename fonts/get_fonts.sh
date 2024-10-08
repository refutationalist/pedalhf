#!/usr/bin/bash

# I run arch linux, and I'm expecting ttf-fira-sans and woff2 installed.


dir="/usr/share/fonts/TTF"
fonts=("FiraSans-SemiBold.ttf" "FiraSans-Regular.ttf" )

for ttf in "${fonts[@]}"; do
	cp "${dir}/${ttf}" .
	woff2_compress $ttf
	rm $ttf
done
