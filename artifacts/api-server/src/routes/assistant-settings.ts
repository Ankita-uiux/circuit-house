import { Router, type IRouter } from "express";
import {
  GetAssistantBehaviorSettingsResponse,
  UpdateAssistantBehaviorSettingsBody,
  UpdateAssistantBehaviorSettingsResponse,
} from "@workspace/api-zod";
import {
  getAssistantBehaviorSettings,
  saveAssistantBehaviorSettings,
} from "../lib/assistant-behavior";
import { requireAdmin, verifyAdminPassword } from "../lib/admin-auth";

const router: IRouter = Router();

router.get("/shop/assistant/settings", async (req, res): Promise<void> => {
  try {
    const settings = await getAssistantBehaviorSettings();
    res.json(GetAssistantBehaviorSettingsResponse.parse(settings));
  } catch (error) {
    req.log.error({ error }, "Could not load assistant behavior settings");
    res.status(500).json({ error: "Assistant settings could not be loaded." });
  }
});

router.post("/shop/admin/verify", verifyAdminPassword);

router.put("/shop/assistant/settings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateAssistantBehaviorSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = {
    ...parsed.data,
    persona: parsed.data.persona.trim(),
    tone: parsed.data.tone.trim(),
    initiativeGoal: parsed.data.initiativeGoal.trim(),
    empathyExamples: parsed.data.empathyExamples.map((example) => example.trim()),
    teamPrompt: parsed.data.teamPrompt.trim(),
  };
  if (!settings.teamPrompt) {
    res.status(400).json({ error: "The team prompt cannot be blank. Use Reset to default to start again." });
    return;
  }
  if (!settings.persona || !settings.tone || !settings.initiativeGoal) {
    res.status(400).json({ error: "Persona, tone, and conversation goal cannot be blank." });
    return;
  }
  if (settings.empathyExamples.some((example) => !example)) {
    res.status(400).json({ error: "All five empathy examples need some text." });
    return;
  }

  try {
    const saved = await saveAssistantBehaviorSettings(settings);
    res.json(UpdateAssistantBehaviorSettingsResponse.parse(saved));
  } catch (error) {
    req.log.error({ error }, "Could not save assistant behavior settings");
    res.status(500).json({ error: "Assistant settings could not be saved." });
  }
});

export default router;
