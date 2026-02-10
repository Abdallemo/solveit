APP_NAME := main
BIN_DIR := bin
SRC_DIR := ./cmd

.PHONY: all build run watch clean test fmt install-tools

all: build

build:
	go build -o $(BIN_DIR)/$(APP_NAME) $(SRC_DIR)

run: build
	./$(BIN_DIR)/$(APP_NAME)

watch:
	air -c air.toml

clean:
	go clean -r $(SRC_DIR)
	rm -f $(BIN_DIR)/$(APP_NAME)
	rm -rf tmp

test:
	go test ./...

fmt:
	go fmt ./...

install-tools:
	go install github.com/air-verse/air@latest
