import { test } from "node:test";
import assert from "node:assert/strict";
import { PostSchema } from "./shared";

test("PostSchema accepts a well-formed post", () => {
  const result = PostSchema.safeParse({
    title: "Photo nouveau menu",
    content: "Notre nouvelle carte arrive !",
    channel: "instagram",
    scheduledDate: "2026-09-18",
    scheduledTime: "18:00",
    status: "scheduled",
  });
  assert.ok(result.success);
});

test("PostSchema rejects an unknown channel", () => {
  const result = PostSchema.safeParse({
    title: "Titre",
    content: "Texte",
    channel: "tiktok",
    scheduledDate: "2026-09-18",
    scheduledTime: "18:00",
    status: "draft",
  });
  assert.equal(result.success, false);
});

test("PostSchema rejects 'published' as a creation status — only markPostPublished can set it", () => {
  const result = PostSchema.safeParse({
    title: "Titre",
    content: "Texte",
    channel: "facebook",
    scheduledDate: "2026-09-18",
    scheduledTime: "18:00",
    status: "published",
  });
  assert.equal(result.success, false);
});

test("PostSchema rejects an empty title", () => {
  const result = PostSchema.safeParse({
    title: "",
    content: "Texte",
    channel: "email",
    scheduledDate: "2026-09-18",
    scheduledTime: "18:00",
    status: "draft",
  });
  assert.equal(result.success, false);
});

test("PostSchema rejects a malformed date", () => {
  const result = PostSchema.safeParse({
    title: "Titre",
    content: "Texte",
    channel: "sms",
    scheduledDate: "18/09/2026",
    scheduledTime: "18:00",
    status: "draft",
  });
  assert.equal(result.success, false);
});

test("PostSchema treats mediaNote as optional", () => {
  const result = PostSchema.safeParse({
    title: "Titre",
    content: "Texte",
    channel: "instagram",
    scheduledDate: "2026-09-18",
    scheduledTime: "18:00",
    status: "draft",
  });
  assert.ok(result.success);
});
