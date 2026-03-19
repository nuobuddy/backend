import { Router } from "express"
import { settingsService } from "@/lib/settingsService"

const router = Router()

router.get("/", (req, res) => {
  const settings = settingsService.getSettings()
  res.json(settings)
})

router.put("/", (req, res) => {
  const updated = settingsService.updateSettings(req.body)
  res.json(updated)
})

export default router