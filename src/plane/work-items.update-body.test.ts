/**
 * Mapping the domain update patch to the Plane API body.
 *
 * The domain expresses an edit as { state_id, priority, assignee_ids, ... }, but
 * the Plane issues endpoint expects { state, priority, assignees, labels }. The
 * PATCH used to send the domain patch verbatim, so state/assignee changes were
 * silently dropped (the API returns 200 but ignores unknown fields). toApiBody
 * performs that translation and must carry only the keys actually present.
 */

import { describe, it, expect } from "vitest";
import { toApiBody } from "./work-items.js";

describe("toApiBody", () => {
  // state_id -> state, assignee_ids -> assignees, label_ids -> labels.
  it("should rename domain fields to the API field names", () => {
    expect(
      toApiBody({
        state_id: "s-doing",
        assignee_ids: ["u-1", "u-2"],
        label_ids: ["l-1"],
        priority: "high",
      }),
    ).toEqual({
      state: "s-doing",
      assignees: ["u-1", "u-2"],
      labels: ["l-1"],
      priority: "high",
    });
  });

  // Only the keys present in the patch are sent (so a state-only edit does not
  // blank out assignees by sending an undefined `assignees`).
  it("should include only the keys present in the patch", () => {
    expect(toApiBody({ state_id: "s-done" })).toEqual({ state: "s-done" });
    expect(toApiBody({ assignee_ids: [] })).toEqual({ assignees: [] });
    expect(toApiBody({ priority: "none" })).toEqual({ priority: "none" });
  });

  // name passes through; description is converted to description_html, since
  // Plane silently ignores a plain `description` field on the issues endpoint.
  it("should pass through name and send description as description_html", () => {
    expect(toApiBody({ name: "New title", description: "body" })).toEqual({
      name: "New title",
      description_html: "<p>body</p>",
    });
  });

  it("should send empty description_html when the description is cleared", () => {
    expect(toApiBody({ description: "" })).toEqual({ description_html: "" });
  });

  it("should produce an empty body for an empty patch", () => {
    expect(toApiBody({})).toEqual({});
  });
});
