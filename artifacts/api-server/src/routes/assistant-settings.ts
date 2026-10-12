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

router.put("/shop/assistant/settings", async (req, res): Promise<void> => {
  const parsed = UpdateAssistantBehaviorSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = {
    ...parsed.data,
    persona: parsed.data.persona.trim(),
    tone: parsed.data.tone.trim(),
  };
  if (!settings.persona || !settings.tone) {
    res.status(400).json({ error: "Persona and tone cannot be blank." });
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
