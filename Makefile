SRC    = harvester.js
TARGET = bookmarklet.js

all: install lint $(TARGET)


# Compile/minify bookmarklet
$(TARGET): $(SRC)
	echo 'javascript:(()=>{' > $@
	npx terser $^ -m >> $@
	printf 'let q=prompt("Enter an extension or filename to harvest:");' >> $@
	printf 'q&&harvest(q)})();' >> $@
	node -c $@


# Check syntax of JS files
lint:
	npx eslint $(SRC)


# Install required dependencies
install:
	@(command -v terser 2>&1 >/dev/null) || npm install -g terser
	@(command -v eslint 2>&1 >/dev/null) || npm install -g eslint


# Delete generated files
clean:
	rm -f $(TARGET)


.PHONY: clean install
