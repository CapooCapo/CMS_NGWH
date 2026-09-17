import assert from "node:assert/strict";
import test from "node:test";
import { toVideoEmbed } from "@/lib/videoEmbed";

test("turns public YouTube URLs into privacy-enhanced embeds", () => {
  assert.deepEqual(toVideoEmbed("https://www.youtube.com/watch?v=y1gthAt8FgU"), {
    provider: "youtube",
    src: "https://www.youtube-nocookie.com/embed/y1gthAt8FgU?rel=0&modestbranding=1",
  });
  assert.deepEqual(toVideoEmbed("https://youtu.be/ZtS8Yc0ah7c"), {
    provider: "youtube",
    src: "https://www.youtube-nocookie.com/embed/ZtS8Yc0ah7c?rel=0&modestbranding=1",
  });
});

test("supports a public Vimeo URL but rejects untrusted iframe URLs", () => {
  assert.deepEqual(toVideoEmbed("https://vimeo.com/123456789"), {
    provider: "vimeo",
    src: "https://player.vimeo.com/video/123456789",
  });
  assert.equal(toVideoEmbed("https://example.com/embed/anything"), null);
  assert.equal(toVideoEmbed("javascript:alert(1)"), null);
  assert.equal(toVideoEmbed("https://www.youtube.com/watch?v=too-short"), null);
});
