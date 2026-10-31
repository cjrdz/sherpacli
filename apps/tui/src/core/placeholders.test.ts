import { describe, expect, test } from "bun:test";
import { collectParams, fillPlaceholders, parsePlaceholders, resolveCommand, shellQuote } from "./placeholders";

describe("parsePlaceholders", () => {
	test("finds angle and brace tokens once each, in order", () => {
		const params = parsePlaceholders("kubectl logs -f -c <container-name> <pod-name> {{ns}} <pod-name>");
		expect(params.map((param) => param.name)).toEqual(["container-name", "pod-name", "ns"]);
		expect(params[0]?.prompt).toBe("Container name");
	});

	test("reads inline defaults", () => {
		const params = parsePlaceholders("docker run -p <port:8080>:80 {{image:nginx}}");
		expect(params).toEqual([
			{ name: "port", prompt: "Port", defaultValue: "8080" },
			{ name: "image", prompt: "Image", defaultValue: "nginx" },
		]);
	});

	test("ignores redirects, heredocs, and brace expansions", () => {
		expect(parsePlaceholders("sort < input.txt")).toEqual([]);
		expect(parsePlaceholders("cat <<EOF")).toEqual([]);
		expect(parsePlaceholders("for i in {1..5}; do echo $i; done")).toEqual([]);
		expect(parsePlaceholders("curl -w '%{http_code}' https://example.com")).toEqual([]);
	});
});

describe("fillPlaceholders", () => {
	test("substitutes values, then defaults, and keeps unknown tokens", () => {
		const command = "docker run -p <port:8080>:80 --name <name> <image>";
		expect(fillPlaceholders(command, { name: "web" })).toBe("docker run -p 8080:80 --name web <image>");
	});
});

describe("script args", () => {
	const item = {
		args: [
			{ name: "dir", prompt: "Directory to own", default: "." },
			{ name: "user", prompt: "User" },
		],
	};

	test("collectParams merges args with tokens", () => {
		const params = collectParams("chownUp {{user}}", item);
		expect(params).toEqual([
			{ name: "user", prompt: "User", defaultValue: undefined },
			{ name: "dir", prompt: "Directory to own", defaultValue: "." },
		]);
	});

	test("resolveCommand appends untokenized args as quoted positionals", () => {
		expect(resolveCommand("chownUp {{user}}", item, { user: "me", dir: "/srv/my data" })).toBe(
			"chownUp me '/srv/my data'",
		);
	});
});

test("shellQuote", () => {
	expect(shellQuote("simple/path-1.txt")).toBe("simple/path-1.txt");
	expect(shellQuote("it's here")).toBe(`'it'\\''s here'`);
});
