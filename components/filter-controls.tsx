"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Palette, Sparkles, User, Camera } from "lucide-react"

interface FilterControlsProps {
  onFiltersChange: (filters: any) => void
  isConnected: boolean
}

export function FilterControls({ onFiltersChange, isConnected }: FilterControlsProps) {
  const [filters, setFilters] = useState({
    // Background
    backgroundRemoval: false,
    backgroundReplacement: "blur",

    // Face Enhancement
    faceEnhancement: false,
    skinSmoothing: 0,
    eyeBrightening: 0,
    teethWhitening: 0,

    // Color Adjustments
    brightness: 0,
    contrast: 0,
    saturation: 0,

    // Effects
    vintage: false,
    colorFilter: "none",
    blur: 0,
  })

  const updateFilter = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          AI Filters
          {isConnected ? (
            <Badge variant="default">
              <Sparkles className="h-3 w-3 mr-1" />
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">Offline</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Background Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <Label className="text-sm font-medium">Background</Label>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="bg-removal" className="text-sm">
              Remove Background
            </Label>
            <Switch
              id="bg-removal"
              checked={filters.backgroundRemoval}
              onCheckedChange={(checked) => updateFilter("backgroundRemoval", checked)}
            />
          </div>

          {filters.backgroundRemoval && (
            <div className="space-y-2">
              <Label className="text-sm">Background Style</Label>
              <Select
                value={filters.backgroundReplacement}
                onValueChange={(value) => updateFilter("backgroundReplacement", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blur">Blur Original</SelectItem>
                  <SelectItem value="gradient">Gradient</SelectItem>
                  <SelectItem value="beach">Beach Scene</SelectItem>
                  <SelectItem value="dark">Dark Background</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Face Enhancement */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <Label className="text-sm font-medium">Face Enhancement</Label>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="face-enhancement" className="text-sm">
              Enable Face Enhancement
            </Label>
            <Switch
              id="face-enhancement"
              checked={filters.faceEnhancement}
              onCheckedChange={(checked) => updateFilter("faceEnhancement", checked)}
            />
          </div>

          {filters.faceEnhancement && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Skin Smoothing: {filters.skinSmoothing}%</Label>
                <Slider
                  value={[filters.skinSmoothing]}
                  onValueChange={([value]) => updateFilter("skinSmoothing", value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Eye Brightening: {filters.eyeBrightening}%</Label>
                <Slider
                  value={[filters.eyeBrightening]}
                  onValueChange={([value]) => updateFilter("eyeBrightening", value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Teeth Whitening: {filters.teethWhitening}%</Label>
                <Slider
                  value={[filters.teethWhitening]}
                  onValueChange={([value]) => updateFilter("teethWhitening", value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Color Adjustments */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Color Adjustments</Label>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">
                Brightness: {filters.brightness > 0 ? "+" : ""}
                {filters.brightness}
              </Label>
              <Slider
                value={[filters.brightness]}
                onValueChange={([value]) => updateFilter("brightness", value)}
                min={-50}
                max={50}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Contrast: {filters.contrast > 0 ? "+" : ""}
                {filters.contrast}%
              </Label>
              <Slider
                value={[filters.contrast]}
                onValueChange={([value]) => updateFilter("contrast", value)}
                min={-50}
                max={50}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Saturation: {filters.saturation > 0 ? "+" : ""}
                {filters.saturation}%
              </Label>
              <Slider
                value={[filters.saturation]}
                onValueChange={([value]) => updateFilter("saturation", value)}
                min={-50}
                max={50}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Effects */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Effects</Label>

          <div className="flex items-center justify-between">
            <Label htmlFor="vintage" className="text-sm">
              Vintage Effect
            </Label>
            <Switch
              id="vintage"
              checked={filters.vintage}
              onCheckedChange={(checked) => updateFilter("vintage", checked)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Color Filter</Label>
            <Select value={filters.colorFilter} onValueChange={(value) => updateFilter("colorFilter", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cool">Cool</SelectItem>
                <SelectItem value="bw">Black & White</SelectItem>
                <SelectItem value="sepia">Sepia</SelectItem>
                <SelectItem value="vibrant">Vibrant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Background Blur: {filters.blur}</Label>
            <Slider
              value={[filters.blur]}
              onValueChange={([value]) => updateFilter("blur", value)}
              max={10}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        {!isConnected && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-700 text-sm">Connect to Oracle server to enable AI filters</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
