import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import * as ts from "typescript";

type MessageTree = { [key: string]: MessageTree | string };

const root = process.cwd();

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  }));
  return nested.flat();
}

function unwrap(expression: ts.Expression): ts.Expression {
  if (ts.isAwaitExpression(expression) || ts.isParenthesizedExpression(expression)) {
    return unwrap(expression.expression);
  }
  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    return unwrap(expression.expression);
  }
  return expression;
}

function translationNamespace(expression: ts.Expression): string | null {
  const call = unwrap(expression);
  if (
    !ts.isCallExpression(call) ||
    !ts.isIdentifier(call.expression) ||
    (call.expression.text !== "useTranslations" && call.expression.text !== "getTranslations")
  ) return null;
  const namespace = call.arguments[0];
  return namespace && ts.isStringLiteral(namespace) ? namespace.text : null;
}

function promiseAllArguments(expression: ts.Expression): readonly ts.Expression[] | null {
  const call = unwrap(expression);
  if (
    !ts.isCallExpression(call) ||
    !ts.isPropertyAccessExpression(call.expression) ||
    !ts.isIdentifier(call.expression.expression) ||
    call.expression.expression.text !== "Promise" ||
    call.expression.name.text !== "all"
  ) return null;
  const argument = call.arguments[0];
  return argument && ts.isArrayLiteralExpression(argument) ? argument.elements : null;
}

function messageAt(messages: MessageTree, dottedPath: string): MessageTree | string | undefined {
  return dottedPath.split(".").reduce<MessageTree | string | undefined>((value, part) => (
    value && typeof value === "object" ? value[part] : undefined
  ), messages);
}

function collectTranslationCalls(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const calls: string[] = [];

  const visit = (node: ts.Node, inherited: ReadonlyMap<string, string>) => {
    const bindings = new Map(inherited);
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name)) {
        const namespace = translationNamespace(node.initializer);
        if (namespace) bindings.set(node.name.text, namespace);
      } else if (ts.isArrayBindingPattern(node.name)) {
        const arguments_ = promiseAllArguments(node.initializer);
        if (arguments_) {
          node.name.elements.forEach((element, index) => {
            if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) return;
            const namespace = translationNamespace(arguments_[index]);
            if (namespace) bindings.set(element.name.text, namespace);
          });
        }
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      bindings.has(node.expression.text) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      calls.push(`${bindings.get(node.expression.text)}.${node.arguments[0].text}`);
    }
    ts.forEachChild(node, (child) => visit(child, bindings));
  };

  visit(source, new Map());
  return calls;
}

test("English and Vietnamese message trees have identical keys", async () => {
  const [en, vi] = await Promise.all(["en", "vi"].map(async (locale) => (
    JSON.parse(await readFile(path.join(root, "messages", `${locale}.json`), "utf8")) as MessageTree
  )));
  const compare = (left: MessageTree | string, right: MessageTree | string, prefix = "") => {
    assert.equal(typeof left, typeof right, `${prefix} has different value types`);
    if (typeof left === "string" || typeof right === "string") return;
    assert.deepEqual(Object.keys(left).sort(), Object.keys(right).sort(), `${prefix} has different keys`);
    for (const key of Object.keys(left)) compare(left[key], right[key], prefix ? `${prefix}.${key}` : key);
  };
  compare(en, vi);
});

test("static app and component translation calls resolve in every locale", async () => {
  const [en, vi, appFiles, componentFiles] = await Promise.all([
    readFile(path.join(root, "messages", "en.json"), "utf8").then((value) => JSON.parse(value) as MessageTree),
    readFile(path.join(root, "messages", "vi.json"), "utf8").then((value) => JSON.parse(value) as MessageTree),
    sourceFiles(path.join(root, "src", "app")),
    sourceFiles(path.join(root, "src", "components")),
  ]);
  const missing = [...new Set([...appFiles, ...componentFiles].flatMap((file) => (
    collectTranslationCalls(file)
      .filter((key) => typeof messageAt(en, key) !== "string" || typeof messageAt(vi, key) !== "string")
      .map((key) => `${path.relative(root, file)}: ${key}`)
  )))];
  assert.deepEqual(missing, [], `Missing translation keys:\n${missing.join("\n")}`);
});
