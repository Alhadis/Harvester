SRC    = harvester.js
TARGET = bookmarklet.js

all: install lint $(TARGET)
	

# Compile/minify bookmarklet
$(TARGET): $(SRC)
	echo 'javascript:(()=>{' > $@
	uglifyjs $^ -m >> $@
	printf 'let q=prompt("Enter an extension or filename to harvest:");' >> $@
	printf 'q&&harvest(q)})();' >> $@
	node -c $@


# Check syntax of JS files
lint:
	eslint $(SRC)


# Install required dependencies
install:
	@(command -v uglifyjs 2>&1 >/dev/null) || npm -g uglify-es
	@(command -v eslint   2>&1 >/dev/null) || npm -g eslint


# Delete generated files
clean:
	rm -f $(TARGET)


.PHONY: clean install
