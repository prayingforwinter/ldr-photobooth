"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Palette, User, Sparkles, Eye, Smile, Sun, Contrast, Zap, Camera, RefreshCw } from "lucide-react"

interface FilterSettings {
  backgroundRemoval: boolean
  backgroundReplacement: string
  faceEnhancement: boolean
  skinSmoothing: number
  eyeBrightening: number
  teethWhitening: number
  brightness: number
  contrast: number
  saturation: number
  vintage: boolean
  blur: number
  colorFilter: string
}

interface FilterControlsProps {
  onFiltersChange: (filters: FilterSettings) => void
  isConnected: boolean
}

export function FilterControls({ onFiltersChange, isConnected }: FilterControlsProps) {
  const [filters, setFilters] = useState<FilterSettings>({
    backgroundRemoval: false,
    backgroundReplacement: "none",
    faceEnhancement: false,
    skinSmoothing: 0,
    eyeBrightening: 0,
    teethWhitening: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    vintage: false,
    blur: 0,
    colorFilter: "none",
  })

  const [isApplying, setIsApplying] = useState(false)

  const updateFilter = (key: keyof FilterSettings, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const applyFilters = async () => {
    setIsApplying(true)
    // Simulate filter application delay
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsApplying(false)
  }

  const resetFilters = () => {
    const defaultFilters: FilterSettings = {
      backgroundRemoval: false,
      backgroundReplacement: "none",
      faceEnhancement: false,
      skinSmoothing: 0,
      eyeBrightening: 0,
      teethWhitening: 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      vintage: false,
      blur: 0,
      colorFilter: "none",
    }
    setFilters(defaultFilters)
    onFiltersChange(defaultFilters)
  }

  const backgroundOptions = [
    { value: "none", label: "Original Background" },
    { value: "blur", label: "Blurred Background" },
    { value: "beach", label: "Beach Scene" },
    { value: "office", label: "Modern Office" },
    { value: "nature", label: "Nature Scene" },
    { value: "studio", label: "Photo Studio" },
    { value: "gradient", label: "Color Gradient" },
  ]

  const colorFilterOptions = [
    { value: "none", label: "No Filter" },
    { value: "warm", label: "Warm Tone" },
    { value: "cool", label: "Cool Tone" },
    { value: "sepia", label: "Sepia" },
    { value: "bw", label: "Black & White" },
    { value: "vibrant", label: "Vibrant" },
    { value: "pastel", label: "Pastel" },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          AI Filter Controls
          <Badge variant={isConnected ? "default" : "secondary"}>{isConnected ? "Live Processing" : "Offline"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Background Controls */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <Label className="font-medium">Background</Label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="bg-removal">Remove Background</Label>
              <Switch
                id="bg-removal"
                checked={filters.backgroundRemoval}
                onCheckedChange={(value) => updateFilter("backgroundRemoval", value)}
                disabled={!isConnected}
              />
            </div>

            {filters.backgroundRemoval && (
              <div className="space-y-2">
                <Label>Background Replacement</Label>
                <Select
                  value={filters.backgroundReplacement}
                  onValueChange={(value) => updateFilter("backgroundReplacement", value)}
                  disabled={!isConnected}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {backgroundOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Face Enhancement */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <Label className="font-medium">Face Enhancement</Label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="face-enhancement">Enable Face Enhancement</Label>
              <Switch
                id="face-enhancement"
                checked={filters.faceEnhancement}
                onCheckedChange={(value) => updateFilter("faceEnhancement", value)}
                disabled={!isConnected}
              />
            </div>

            {filters.faceEnhancement && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="h-3 w-3" />
                      Skin Smoothing
                    </Label>
                    <span className="text-sm text-gray-500">{filters.skinSmoothing}%</span>
                  </div>
                  <Slider
                    value={[filters.skinSmoothing]}
                    onValueChange={(value) => updateFilter("skinSmoothing", value[0])}
                    max={100}
                    step={1}
                    disabled={!isConnected}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Eye className="h-3 w-3" />
                      Eye Brightening
                    </Label>
                    <span className="text-sm text-gray-500">{filters.eyeBrightening}%</span>
                  </div>
                  <Slider
                    value={[filters.eyeBrightening]}
                    onValueChange={(value) => updateFilter("eyeBrightening", value[0])}
                    max={100}
                    step={1}
                    disabled={!isConnected}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Smile className="h-3 w-3" />
                      Teeth Whitening
                    </Label>
                    <span className="text-sm text-gray-500">{filters.teethWhitening}%</span>
                  </div>
                  <Slider
                    value={[filters.teethWhitening]}
                    onValueChange={(value) => updateFilter("teethWhitening", value[0])}
                    max={100}
                    step={1}
                    disabled={!isConnected}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Color & Lighting */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <Label className="font-medium">Color & Lighting</Label>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Brightness</Label>
                <span className="text-sm text-gray-500">
                  {filters.brightness > 0 ? "+" : ""}
                  {filters.brightness}
                </span>
              </div>
              <Slider
                value={[filters.brightness]}
                onValueChange={(value) => updateFilter("brightness", value[0])}
                min={-50}
                max={50}
                step={1}
                disabled={!isConnected}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Contrast className="h-3 w-3" />
                  Contrast
                </Label>
                <span className="text-sm text-gray-500">
                  {filters.contrast > 0 ? "+" : ""}
                  {filters.contrast}
                </span>
              </div>
              <Slider
                value={[filters.contrast]}
                onValueChange={(value) => updateFilter("contrast", value[0])}
                min={-50}
                max={50}
                step={1}
                disabled={!isConnected}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Saturation</Label>
                <span className="text-sm text-gray-500">
                  {filters.saturation > 0 ? "+" : ""}
                  {filters.saturation}
                </span>
              </div>
              <Slider
                value={[filters.saturation]}
                onValueChange={(value) => updateFilter("saturation", value[0])}
                min={-50}
                max={50}
                step={1}
                disabled={!isConnected}
              />
            </div>

            <div className="space-y-2">
              <Label>Color Filter</Label>
              <Select
                value={filters.colorFilter}
                onValueChange={(value) => updateFilter("colorFilter", value)}
                disabled={!isConnected}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Special Effects */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <Label className="font-medium">Special Effects</Label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="vintage">Vintage Effect</Label>
              <Switch
                id="vintage"
                checked={filters.vintage}
                onCheckedChange={(value) => updateFilter("vintage", value)}
                disabled={!isConnected}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Background Blur</Label>
                <span className="text-sm text-gray-500">{filters.blur}px</span>
              </div>
              <Slider
                value={[filters.blur]}
                onValueChange={(value) => updateFilter("blur", value[0])}
                max={20}
                step={1}
                disabled={!isConnected}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={applyFilters} disabled={!isConnected || isApplying} className="flex-1">
            {isApplying ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Apply Filters
              </>
            )}
          </Button>
          <Button onClick={resetFilters} variant="outline" disabled={!isConnected}>
            Reset
          </Button>
        </div>

        {!isConnected && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-700 text-sm">⚠️ Connect to Oracle stream server to use AI filters</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
