import { test } from "node:test";
import assert from "node:assert/strict";
import { isIos } from "./install-store";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

test("un iPhone est reconnu", () => assert.equal(isIos(IPHONE, 5), true));
test("un iPad qui se fait passer pour un Mac est reconnu grâce à l'écran tactile", () => assert.equal(isIos(MAC, 5), true));
test("un vrai Mac ne l'est pas", () => assert.equal(isIos(MAC, 0), false));
test("un Android ne l'est pas", () => assert.equal(isIos(ANDROID, 5), false));
