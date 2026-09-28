import { test } from "node:test";
import assert from "node:assert/strict";
import { filterHref, shouldNavigate } from "../lib/navigation.ts";

test("filter submission preserves repeated choices and resets the page", () => {
  const data = new FormData();
  data.append("sources", "selected");
  data.append("district", "Mitte");
  data.append("district", "Pankow");
  data.append("minRent", "800");
  data.append("maxRent", "");
  data.append("page", "3");
  assert.equal(
    filterHref(data),
    "/?sources=selected&district=Mitte&district=Pankow&minRent=800",
  );
});

test("client navigation only intercepts ordinary primary clicks", () => {
  const event = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };
  assert.equal(shouldNavigate(event), true);
  for (const key of [
    "metaKey",
    "ctrlKey",
    "shiftKey",
    "altKey",
    "defaultPrevented",
  ]) {
    assert.equal(shouldNavigate({ ...event, [key]: true }), false);
  }
  assert.equal(shouldNavigate({ ...event, button: 1 }), false);
});
