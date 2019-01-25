MAKEFLAGS = -j1
TEST262_COMMIT = 4f1155c566a222238fd86f179c6635ecb4c289bb

bootstrap-test262:
	rm -rf ./test262
	git clone --branch=master --single-branch --shallow-since=2019-01-10 https://github.com/tc39/test262.git ./build/test262
	cd build/test262 && git checkout $(TEST262_COMMIT)
