"use client"

import { DialogTrigger } from "@/components/ui/dialog"
import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  Upload,
  Search,
  Send,
  Settings,
  Loader2,
  AlertCircle,
  Database,
  FileEdit,
  UploadIcon,
  RefreshCw,
  PlayCircle,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

// Update the SearchResult interface to include the videoUrl field
interface SearchResult {
  id: number
  title: string
  text: string
  timestamp: number
  details: string
  startTimeMs?: number
  endTimeMs?: number
  rawFields?: any
  videoUrl?: string // Add videoUrl field
}

interface EnvSettings {
  baseUrl: string
  AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME: string
  AZURE_OPENAI_EMBEDDINGS_API_VERSION: string
  AZURE_OPENAI_COMPLETIONS_API_VERSION: string
  AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME: string
  AZURE_OPENAI_ENDPOINT: string
  AZURE_OPENAI_API_KEY: string
  AZURE_SEARCH_ENDPOINT: string
  AZURE_SEARCH_ADMIN_KEY: string
  INDEX_NAME: string
  AZURE_AI_SERVICES_ENDPOINT: string
  AZURE_AI_SERVICES_API_VERSION: string
  AZURE_AI_SERVICES_API_KEY: string
}

// Default JSON configuration
const DEFAULT_JSON_CONFIG = {
  analyzerId: "video_cu_analyzer",
  name: "Video Content Understanding",
  description: "Generating content understanding from video.",
  scenario: "videoShot",
  config: {
    returnDetails: true,
    locales: ["en-US", "es-ES", "es-MX", "fr-FR", "hi-IN", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN"],
    enableFace: false,
  },
  fieldSchema: {
    name: "Content Understanding",
    descriptions: "Generate content understanding from video.",
    fields: {
      segmentDescription: {
        type: "string",
        description: "Detailed summary of the video segment, focusing on people, places, and actions taking place.",
      },
    },
  },
}

export default function Home() {
  const [jsonData, setJsonData] = useState<any>(null)
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  // Update the chatMessages state to include timestamp property
  const [chatMessages, setChatMessages] = useState<
    { role: string; content: string; timestamp?: number | null; videoUrl?: string }[]
  >([])
  const [chatInput, setChatInput] = useState<string>("")
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [jsonEditorContent, setJsonEditorContent] = useState<string>(JSON.stringify(DEFAULT_JSON_CONFIG, null, 2))
  const [isJsonValid, setIsJsonValid] = useState<boolean>(true)
  const [settings, setSettings] = useState<EnvSettings>({
    baseUrl: "http://127.0.0.1:5000", // Default to your Flask server
    AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME: "",
    AZURE_OPENAI_EMBEDDINGS_API_VERSION: "",
    AZURE_OPENAI_COMPLETIONS_API_VERSION: "",
    AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME: "",
    AZURE_OPENAI_ENDPOINT: "",
    AZURE_OPENAI_API_KEY: "",
    AZURE_SEARCH_ENDPOINT: "",
    AZURE_SEARCH_ADMIN_KEY: "",
    INDEX_NAME: "",
    AZURE_AI_SERVICES_ENDPOINT: "",
    AZURE_AI_SERVICES_API_VERSION: "",
    AZURE_AI_SERVICES_API_KEY: "",
  })
  const [isSettingsComplete, setIsSettingsComplete] = useState<boolean>(false)
  const [showSettingsAlert, setShowSettingsAlert] = useState<boolean>(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  // Update the chat state to include a loading indicator
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false)
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false)
  // Add searchType state
  const [searchType, setSearchType] = useState<"similarity" | "hybrid">("similarity")
  const [uploadedVideoUrls, setUploadedVideoUrls] = useState<string[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const { toast } = useToast()

  // Validate JSON when editor content changes
  useEffect(() => {
    try {
      JSON.parse(jsonEditorContent)
      setIsJsonValid(true)
    } catch (e) {
      setIsJsonValid(false)
    }
  }, [jsonEditorContent])

  // Helper function to safely convert any value to a string for display
  const safeStringify = (value: any): string => {
    if (value === null) return "null"
    if (value === undefined) return "undefined"

    // Handle arrays by processing each element
    if (Array.isArray(value)) {
      try {
        return JSON.stringify(
          value.map((item) => (typeof item === "object" && item !== null ? safeStringify(item) : item)),
          null,
          2,
        )
      } catch (e) {
        return "[Complex Array]"
      }
    }

    // Special handling for objects with type and valueString properties
    if (typeof value === "object" && value !== null) {
      if ("type" in value && "valueString" in value) {
        return value.valueString?.toString() || "[Object with valueString]"
      }

      // For other objects, try to stringify them
      try {
        // Process each property to handle nested objects with type/valueString
        const processedObj = {}
        for (const [k, v] of Object.entries(value)) {
          processedObj[k] = typeof v === "object" && v !== null ? safeStringify(v) : v
        }
        return JSON.stringify(processedObj, null, 2)
      } catch (e) {
        return "[Complex Object]"
      }
    }

    return String(value)
  }

  // Check if settings are complete
  useEffect(() => {
    // Check if all settings are populated
    const allSettingsComplete =
      settings.baseUrl.trim() !== "" &&
      settings.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME.trim() !== "" &&
      settings.AZURE_OPENAI_EMBEDDINGS_API_VERSION.trim() !== "" &&
      settings.AZURE_OPENAI_COMPLETIONS_API_VERSION.trim() !== "" &&
      settings.AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME.trim() !== "" &&
      settings.AZURE_OPENAI_ENDPOINT.trim() !== "" &&
      settings.AZURE_OPENAI_API_KEY.trim() !== "" &&
      settings.AZURE_SEARCH_ENDPOINT.trim() !== "" &&
      settings.AZURE_SEARCH_ADMIN_KEY.trim() !== "" &&
      settings.INDEX_NAME.trim() !== "" &&
      settings.AZURE_AI_SERVICES_ENDPOINT.trim() !== "" &&
      settings.AZURE_AI_SERVICES_API_VERSION.trim() !== "" &&
      settings.AZURE_AI_SERVICES_API_KEY.trim() !== ""

    setIsSettingsComplete(allSettingsComplete)

    // We no longer auto-complete settings since all fields are required
  }, [settings])

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSettingsComplete) {
      setShowSettingsAlert(true)
      return
    }

    const file = e.target.files?.[0]
    if (file) {
      try {
        // Read the file content and update the editor
        const fileContent = await file.text()
        setJsonEditorContent(fileContent)

        // Parse the file to validate it's JSON
        JSON.parse(fileContent)

        toast({
          title: "JSON File Loaded",
          description: "JSON file has been loaded into the editor. Click Upload to process it.",
        })
      } catch (error) {
        console.error("JSON parsing error:", error)

        toast({
          title: "Invalid JSON File",
          description: "The selected file is not valid JSON.",
          variant: "destructive",
        })
      } finally {
        // Reset the file input so the same file can be uploaded again if needed
        const fileInput = document.getElementById("json-upload") as HTMLInputElement
        if (fileInput) {
          fileInput.value = ""
        }
      }
    }
  }

  const handleCombinedUpload = async () => {
    if (!isSettingsComplete) {
      setShowSettingsAlert(true)
      return
    }

    if (!isJsonValid) {
      toast({
        title: "Invalid JSON",
        description: "Please correct the JSON format before uploading.",
        variant: "destructive",
      })
      return
    }

    if (videoUrl.trim() === "") {
      toast({
        title: "Missing Video URL",
        description: "Please enter a video URL before uploading.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      // Parse the JSON from the editor
      const jsonContent = JSON.parse(jsonEditorContent)

      // Convert the JSON to a Blob to send as a file
      const jsonBlob = new Blob([jsonEditorContent], { type: "application/json" })
      const jsonFile = new File([jsonBlob], "config.json", { type: "application/json" })

      // Create FormData to send the file and video URL
      const formData = new FormData()
      formData.append("jsonFile", jsonFile)
      formData.append("videoUrl", videoUrl)

      // Send the data to the Flask backend API
      const response = await fetch(`${settings.baseUrl}/upload`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server responded with ${response.status}`)
      }

      const data = await response.json()
      setJsonData(data)

      toast({
        title: "Upload Successful",
        description: "Your JSON configuration and video URL have been processed by the server.",
      })

      // Add the current video URL to the list of uploaded URLs if it's not already there
      if (!uploadedVideoUrls.includes(videoUrl)) {
        setUploadedVideoUrls((prev) => [...prev, videoUrl])
      }
    } catch (error) {
      console.error("Upload error:", error)

      toast({
        title: "Upload Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to connect to the server. Make sure your Flask server is running.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const resetJsonEditor = () => {
    setJsonEditorContent(JSON.stringify(DEFAULT_JSON_CONFIG, null, 2))
    toast({
      title: "JSON Reset",
      description: "The JSON editor has been reset to the default configuration.",
    })
  }

  const formatJsonEditor = () => {
    try {
      const parsed = JSON.parse(jsonEditorContent)
      setJsonEditorContent(JSON.stringify(parsed, null, 2))
      toast({
        title: "JSON Formatted",
        description: "The JSON has been formatted.",
      })
    } catch (e) {
      toast({
        title: "Format Failed",
        description: "Cannot format invalid JSON. Please fix the syntax errors first.",
        variant: "destructive",
      })
    }
  }

  // Update the handleSearch function to include searchType in the API call and extract videoUrl
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSettingsComplete) {
      setShowSettingsAlert(true)
      return
    }

    if (searchQuery.trim() === "") return

    try {
      setSearchResults([]) // Clear previous results

      // Call the backend search API with searchType parameter
      const response = await fetch(`${settings.baseUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          searchType: searchType,
        }),
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Format the results from the backend
      if (data.results && Array.isArray(data.results)) {
        const formattedResults: SearchResult[] = data.results.map((result: any, index: number) => {
          // Convert startTimeMs from milliseconds to seconds for the video player
          const timestampInSeconds = result.startTimeMs ? Math.floor(result.startTimeMs / 1000) : 0

          // Extract fields for display
          const fields = result.fields || {}

          console.log(JSON.stringify(result.fields, null, 2))

          return {
            id: index + 1,
            title: `Segment ${index + 1}`,
            text: fields.topic?.valueString || fields.segmentDescription?.valueString || "No description available",
            timestamp: timestampInSeconds,
            details: JSON.stringify(fields, null, 2), // Store all fields as JSON for detailed view
            startTimeMs: result.startTimeMs,
            endTimeMs: result.endTimeMs,
            rawFields: fields, // Store the raw fields for display
            videoUrl: result.videoUrl || "", // Store the video URL from the search result
          }
        })

        setSearchResults(formattedResults)
      } else {
        toast({
          title: "No Results",
          description: "No matching video segments found for your query.",
        })
      }
    } catch (error) {
      console.error("Search error:", error)
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "Failed to retrieve search results",
        variant: "destructive",
      })
    }
  }

  // Update the seekToTimestamp function to handle both timestamp and videoUrl
  const seekToTimestamp = (timestamp: number, resultVideoUrl?: string) => {
    if (videoRef.current) {
      // If a video URL is provided and it's different from the current one, update it
      if (resultVideoUrl && resultVideoUrl !== videoUrl) {
        setVideoUrl(resultVideoUrl)

        // We need to wait for the video to load before seeking
        const handleVideoLoad = () => {
          if (videoRef.current) {
            // If timestamp is in milliseconds (greater than 10000), convert to seconds
            const timeInSeconds = timestamp > 10000 ? timestamp / 1000 : timestamp
            videoRef.current.currentTime = timeInSeconds
            videoRef.current.play()
            // Remove the event listener after it's used
            videoRef.current.removeEventListener("loadeddata", handleVideoLoad)
          }
        }

        // Add event listener for when the video is loaded
        videoRef.current.addEventListener("loadeddata", handleVideoLoad)
      } else {
        // If no video URL is provided or it's the same as current, just seek
        // If timestamp is in milliseconds (greater than 10000), convert to seconds
        const timeInSeconds = timestamp > 10000 ? timestamp / 1000 : timestamp
        videoRef.current.currentTime = timeInSeconds
        videoRef.current.play()
      }
    }
  }

  // Update the handleChatSubmit function to use the backend's /chat endpoint
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSettingsComplete) {
      setShowSettingsAlert(true)
      return
    }

    if (chatInput.trim() === "") return

    const userMessage = { role: "user", content: chatInput }
    // Add the user message immediately for better UX
    setChatMessages((prevMessages) => [...prevMessages, userMessage])

    // Store the input and clear it right away so user can type another message
    const currentInput = chatInput
    setChatInput("")

    // Set loading state
    setIsChatLoading(true)

    try {
      // Call the backend chat API
      const response = await fetch(`${settings.baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: currentInput }),
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`)
      }

      const data = await response.json()

      // Process the AI response to check for URL and timestamp at the end
      let aiContent = data.reply || "Sorry, I couldn't generate a response."
      let timestamp: number | null = null
      let videoUrl: string | undefined = undefined

      // Check if the response ends with a URL followed by a number (timestamp in seconds)
      // This regex looks for a URL pattern followed by a space and then a number at the end of the string
      const urlTimestampMatch = aiContent.match(/(https?:\/\/[^\s]+)\s+(\d+)$/)

      if (urlTimestampMatch) {
        videoUrl = urlTimestampMatch[1]
        timestamp = Number.parseInt(urlTimestampMatch[2], 10)

        // Remove the URL and timestamp from the displayed message
        aiContent = aiContent.replace(/\s*https?:\/\/[^\s]+\s+\d+$/, "")
      } else {
        // Fallback to just looking for a timestamp (for backward compatibility)
        const timestampMatch = aiContent.match(/(\d+)$/)
        if (timestampMatch) {
          timestamp = Number.parseInt(timestampMatch[1], 10)
          // Remove the timestamp from the displayed message
          aiContent = aiContent.replace(/\s*\d+$/, "")
        }
      }

      // Add the AI's response to the chat
      const botMessage = {
        role: "assistant",
        content: aiContent,
        timestamp: timestamp,
        videoUrl: videoUrl,
      }
      setChatMessages((prevMessages) => [...prevMessages, botMessage])
    } catch (error) {
      console.error("Chat error:", error)

      // Add an error message to the chat
      const errorMessage = {
        role: "assistant",
        content: "Sorry, there was an error processing your request. Please try again.",
      }
      setChatMessages((prevMessages) => [...prevMessages, errorMessage])

      toast({
        title: "Chat Failed",
        description: error instanceof Error ? error.message : "Failed to get a response from the AI",
        variant: "destructive",
      })
    } finally {
      setIsChatLoading(false)
    }
  }

  const populateTestConfig = () => {
    setSettings({
      baseUrl: "http://127.0.0.1:5000", // Keep the default Flask server
      AZURE_OPENAI_ENDPOINT: "https://ruibingptv2.openai.azure.com/",
      AZURE_OPENAI_API_KEY: "",
      AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME: "my-gpt-4o",
      AZURE_OPENAI_COMPLETIONS_API_VERSION: "2024-08-01-preview",
      AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME: "text-embedding-ada-002",
      AZURE_OPENAI_EMBEDDINGS_API_VERSION: "2023-05-15",
      INDEX_NAME: "uitest",
      AZURE_SEARCH_ENDPOINT: "https://jianmxsearchtest.search.windows.net",
      AZURE_SEARCH_ADMIN_KEY: "",
      AZURE_AI_SERVICES_ENDPOINT: "https://video-cu.openai.azure.com/",
      AZURE_AI_SERVICES_API_VERSION: "2024-12-01-preview",
      AZURE_AI_SERVICES_API_KEY: "",
    })

    toast({
      title: "Test Configuration Loaded",
      description: "All settings have been populated with test values. Click Save Settings to apply.",
    })
  }

  // Updated saveSettings function to send settings to the backend /config endpoint
  const saveSettings = async () => {
    // Check if any setting is empty
    const emptySettings = Object.entries(settings).filter(([key, value]) => {
      // Skip the baseUrl in the validation
      if (key === "baseUrl") {
        return false
      }
      return value.trim() === ""
    })

    if (emptySettings.length > 0) {
      toast({
        title: "Incomplete Settings",
        description: "All settings fields must be filled in to enable application functionality",
        variant: "destructive",
      })
      return
    }

    setIsSavingSettings(true)

    try {
      // Send settings to the backend /config endpoint
      const configData = {
        AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME: settings.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME,
        AZURE_OPENAI_EMBEDDINGS_API_VERSION: settings.AZURE_OPENAI_EMBEDDINGS_API_VERSION,
        AZURE_OPENAI_ENDPOINT: settings.AZURE_OPENAI_ENDPOINT,
        AZURE_OPENAI_API_KEY: settings.AZURE_OPENAI_API_KEY,
        AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME: settings.AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME,
        AZURE_OPENAI_COMPLETIONS_API_VERSION: settings.AZURE_OPENAI_COMPLETIONS_API_VERSION,
        AZURE_SEARCH_ENDPOINT: settings.AZURE_SEARCH_ENDPOINT,
        AZURE_SEARCH_ADMIN_KEY: settings.AZURE_SEARCH_ADMIN_KEY,
        INDEX_NAME: settings.INDEX_NAME,
        AZURE_AI_SERVICES_ENDPOINT: settings.AZURE_AI_SERVICES_ENDPOINT,
        AZURE_AI_SERVICES_API_VERSION: settings.AZURE_AI_SERVICES_API_VERSION,
        AZURE_AI_SERVICES_API_KEY: settings.AZURE_AI_SERVICES_API_KEY,
      }

      const response = await fetch(`${settings.baseUrl}/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server responded with ${response.status}`)
      }

      const data = await response.json()

      toast({
        title: "Settings Saved",
        description: data.message || "Your configuration has been updated",
      })

      setIsSettingsOpen(false)
    } catch (error) {
      console.error("Settings error:", error)

      toast({
        title: "Settings Update Failed",
        description: error instanceof Error ? error.message : "Failed to update settings on the server",
        variant: "destructive",
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Add a function to format milliseconds as a time string
  const formatMilliseconds = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <main className="container mx-auto p-4 max-w-6xl relative">
      {/* Settings Banner - only shown when settings are incomplete */}
      {!isSettingsComplete && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuration Required</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Please configure all application settings before using this application.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="ml-2 bg-white hover:bg-white/90 text-destructive border-destructive"
            >
              Open Settings
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <h1 className="text-3xl font-bold text-center mb-8">Video Search Sample</h1>

      {/* Settings Button */}
      <div className="fixed right-4 top-4 z-10">
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Application Settings</DialogTitle>
              <DialogDescription>Configure the environment variables required for the application.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="grid gap-4 py-4">
                {/* Test Config Button */}
                <div className="flex justify-end mb-2">
                  <Button variant="outline" onClick={populateTestConfig} className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Populate Test Config
                  </Button>
                </div>

                <h3 className="text-lg font-medium">Basic Settings</h3>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="baseUrl" className="text-right">
                    Base Backend URL
                  </Label>
                  <Input
                    id="baseUrl"
                    value={settings.baseUrl}
                    onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                    className="col-span-3"
                    placeholder="http://127.0.0.1:5000"
                  />
                </div>

                <h3 className="text-lg font-medium mt-4">Azure OpenAI Settings</h3>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_OPENAI_ENDPOINT" className="text-right">
                    OpenAI Endpoint
                  </Label>
                  <Input
                    id="AZURE_OPENAI_ENDPOINT"
                    value={settings.AZURE_OPENAI_ENDPOINT}
                    onChange={(e) => setSettings({ ...settings, AZURE_OPENAI_ENDPOINT: e.target.value })}
                    className="col-span-3"
                    placeholder="https://your-resource.openai.azure.com"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_OPENAI_API_KEY" className="text-right">
                    OpenAI API Key
                  </Label>
                  <Input
                    id="AZURE_OPENAI_API_KEY"
                    type="password"
                    value={settings.AZURE_OPENAI_API_KEY}
                    onChange={(e) => setSettings({ ...settings, AZURE_OPENAI_API_KEY: e.target.value })}
                    className="col-span-3"
                    placeholder="Your Azure OpenAI API key"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME" className="text-right">
                    Embeddings Deployment
                  </Label>
                  <Input
                    id="AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME"
                    value={settings.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME}
                    onChange={(e) =>
                      setSettings({ ...settings, AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="e.g., text-embedding-ada-002"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_OPENAI_EMBEDDINGS_API_VERSION" className="text-right">
                    Embeddings API Version
                  </Label>
                  <Input
                    id="AZURE_OPENAI_EMBEDDINGS_API_VERSION"
                    value={settings.AZURE_OPENAI_EMBEDDINGS_API_VERSION}
                    onChange={(e) => setSettings({ ...settings, AZURE_OPENAI_EMBEDDINGS_API_VERSION: e.target.value })}
                    className="col-span-3"
                    placeholder="e.g., 2023-05-15"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME" className="text-right">
                    Completions Deployment
                  </Label>
                  <Input
                    id="AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME"
                    value={settings.AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME}
                    onChange={(e) =>
                      setSettings({ ...settings, AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="e.g., gpt-4"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_OPENAI_COMPLETIONS_API_VERSION" className="text-right">
                    Completions API Version
                  </Label>
                  <Input
                    id="AZURE_OPENAI_COMPLETIONS_API_VERSION"
                    value={settings.AZURE_OPENAI_COMPLETIONS_API_VERSION}
                    onChange={(e) => setSettings({ ...settings, AZURE_OPENAI_COMPLETIONS_API_VERSION: e.target.value })}
                    className="col-span-3"
                    placeholder="e.g., 2023-05-15"
                  />
                </div>

                <h3 className="text-lg font-medium mt-4">Azure Search Settings</h3>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_SEARCH_ENDPOINT" className="text-right">
                    Search Endpoint
                  </Label>
                  <Input
                    id="AZURE_SEARCH_ENDPOINT"
                    value={settings.AZURE_SEARCH_ENDPOINT}
                    onChange={(e) => setSettings({ ...settings, AZURE_SEARCH_ENDPOINT: e.target.value })}
                    className="col-span-3"
                    placeholder="https://your-search-service.search.windows.net"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_SEARCH_ADMIN_KEY" className="text-right">
                    Search Admin Key
                  </Label>
                  <Input
                    id="AZURE_SEARCH_ADMIN_KEY"
                    type="password"
                    value={settings.AZURE_SEARCH_ADMIN_KEY}
                    onChange={(e) => setSettings({ ...settings, AZURE_SEARCH_ADMIN_KEY: e.target.value })}
                    className="col-span-3"
                    placeholder="Your Azure Search admin key"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="INDEX_NAME" className="text-right">
                    Index Name
                  </Label>
                  <Input
                    id="INDEX_NAME"
                    value={settings.INDEX_NAME}
                    onChange={(e) => setSettings({ ...settings, INDEX_NAME: e.target.value })}
                    className="col-span-3"
                    placeholder="e.g., video-search-index"
                  />
                </div>

                <h3 className="text-lg font-medium mt-4">Azure AI Services Settings</h3>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_AI_SERVICES_ENDPOINT" className="text-right">
                    AI Services Endpoint
                  </Label>
                  <Input
                    id="AZURE_AI_SERVICES_ENDPOINT"
                    value={settings.AZURE_AI_SERVICES_ENDPOINT}
                    onChange={(e) => setSettings({ ...settings, AZURE_AI_SERVICES_ENDPOINT: e.target.value })}
                    className="col-span-3"
                    placeholder="https://your-ai-service.openai.azure.com/"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_AI_SERVICES_API_VERSION" className="text-right">
                    AI Services API Version
                  </Label>
                  <Input
                    id="AZURE_AI_SERVICES_API_VERSION"
                    value={settings.AZURE_AI_SERVICES_API_VERSION}
                    onChange={(e) => setSettings({ ...settings, AZURE_AI_SERVICES_API_VERSION: e.target.value })}
                    className="col-span-3"
                    placeholder="e.g., 2024-12-01-preview"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="AZURE_AI_SERVICES_API_KEY" className="text-right">
                    AI Services API Key
                  </Label>
                  <Input
                    id="AZURE_AI_SERVICES_API_KEY"
                    type="password"
                    value={settings.AZURE_AI_SERVICES_API_KEY}
                    onChange={(e) => setSettings({ ...settings, AZURE_AI_SERVICES_API_KEY: e.target.value })}
                    className="col-span-3"
                    placeholder="Your Azure AI Services API key"
                  />
                </div>
              </div>
            </ScrollArea>
            <div className="flex justify-end pt-4">
              <Button onClick={saveSettings} disabled={isSavingSettings}>
                {isSavingSettings ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Settings Alert Dialog */}
      <AlertDialog open={showSettingsAlert} onOpenChange={setShowSettingsAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Settings Required</AlertDialogTitle>
            <AlertDialogDescription>
              Please configure the application settings before using this feature.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowSettingsAlert(false)
                setIsSettingsOpen(true)
              }}
            >
              Open Settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Combined Video and JSON Config Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Video Analysis Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Video Player Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Video Player</h3>
              <div className="mb-4">
                <Label htmlFor="videoUrl" className="block mb-2">
                  Azure Blob SAS URL
                </Label>
                <Input
                  id="videoUrl"
                  type="text"
                  placeholder="Enter Azure Blob SAS URL"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="aspect-video bg-slate-100 rounded-md overflow-hidden mb-4">
                {videoUrl ? (
                  <video ref={videoRef} src={videoUrl} controls className="w-full h-full">
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <PlayCircle className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                      <p>Enter a video URL to load the player</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Uploaded URLs List */}
              {uploadedVideoUrls.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Previously Uploaded Videos</h4>
                  <div className="border rounded-md h-[100px] overflow-y-auto">
                    <ScrollArea className="h-full w-full">
                      <div className="p-2">
                        {uploadedVideoUrls.map((url, index) => (
                          <div
                            key={index}
                            className="text-xs truncate py-1 px-2 rounded hover:bg-slate-100 cursor-pointer flex items-center"
                            onClick={() => setVideoUrl(url)}
                          >
                            <PlayCircle className="h-3 w-3 mr-2 flex-shrink-0" />
                            <span className="truncate" title={url}>
                              {url.length > 50 ? url.substring(0, 47) + "..." : url}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>

            {/* JSON Config Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Analyzer JSON Config</h3>
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit" className="flex items-center gap-2">
                    <FileEdit className="h-4 w-4" />
                    Edit JSON
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <UploadIcon className="h-4 w-4" />
                    Upload JSON
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="mt-4">
                  <div className="space-y-4">
                    <div className="relative">
                      <Textarea
                        value={jsonEditorContent}
                        onChange={(e) => setJsonEditorContent(e.target.value)}
                        className={`font-mono text-sm h-[300px] ${!isJsonValid ? "border-red-500" : ""}`}
                        placeholder="Edit your JSON configuration here..."
                      />
                      {!isJsonValid && (
                        <div className="absolute top-2 right-2">
                          <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-md">Invalid JSON</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={formatJsonEditor} className="flex-1">
                        Format JSON
                      </Button>
                      <Button variant="outline" onClick={resetJsonEditor} className="flex-1">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="upload" className="mt-4">
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-md p-6 text-center h-[300px] flex flex-col items-center justify-center"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.add("border-primary")
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.remove("border-primary")
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.remove("border-primary")

                      if (!isSettingsComplete) {
                        setShowSettingsAlert(true)
                        return
                      }

                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        const file = e.dataTransfer.files[0]
                        if (file.type === "application/json" || file.name.endsWith(".json")) {
                          // Create a synthetic event to reuse the existing handler
                          const syntheticEvent = {
                            target: {
                              files: e.dataTransfer.files,
                            },
                          } as React.ChangeEvent<HTMLInputElement>

                          handleJsonUpload(syntheticEvent)
                        } else {
                          toast({
                            title: "Invalid File Type",
                            description: "Please upload a JSON file",
                            variant: "destructive",
                          })
                        }
                      }
                    }}
                  >
                    <Upload className="h-12 w-12 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500 mb-2">Drag and drop your JSON file here or click to browse</p>
                    <p className="text-xs text-slate-400 mb-4">Only .json files are supported</p>
                    <Input
                      type="file"
                      accept=".json"
                      onChange={handleJsonUpload}
                      className="hidden"
                      id="json-upload"
                      disabled={!isSettingsComplete}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!isSettingsComplete}
                      onClick={() => {
                        document.getElementById("json-upload")?.click()
                      }}
                    >
                      Select JSON File
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-6">
          <Button
            onClick={handleCombinedUpload}
            disabled={!isJsonValid || !videoUrl || isUploading || !isSettingsComplete}
            className="w-1/2"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" />
                Upload Configuration
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Search Video Content</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="mb-4">
              <div className="flex gap-2 mb-2">
                <Input
                  type="text"
                  placeholder="Enter search query"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                  disabled={!isSettingsComplete}
                />
                <Button type="submit" disabled={!isSettingsComplete}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="similarity"
                    name="searchType"
                    value="similarity"
                    checked={searchType === "similarity"}
                    onChange={() => setSearchType("similarity")}
                    className="h-4 w-4"
                  />
                  <label htmlFor="similarity">Similarity Search</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="hybrid"
                    name="searchType"
                    value="hybrid"
                    checked={searchType === "hybrid"}
                    onChange={() => setSearchType("hybrid")}
                    className="h-4 w-4"
                  />
                  <label htmlFor="hybrid">Hybrid Search</label>
                </div>
              </div>
            </form>

            <div className="space-y-4">
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <div key={result.id} className="border rounded-md overflow-hidden">
                    <div className="p-3 bg-white">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <h3 className="font-medium">{result.title}</h3>
                            <span className="text-sm text-slate-500">{formatTime(result.timestamp)}</span>
                          </div>
                          <p className="text-sm text-slate-600">{result.text}</p>
                        </div>
                        <div className="ml-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              seekToTimestamp(
                                result.startTimeMs !== undefined ? result.startTimeMs : result.timestamp,
                                result.videoUrl,
                              )
                            }
                          >
                            Play
                          </Button>
                        </div>
                      </div>

                      {/* Details section - always visible */}
                      <div className="mt-3 p-3 bg-slate-50 rounded-md border">
                        <div className="mb-4">
                          <span className="text-xs font-medium text-slate-500">TIME RANGE</span>
                          <p className="text-sm mt-1">
                            {result.startTimeMs !== undefined && result.endTimeMs !== undefined
                              ? `${formatMilliseconds(result.startTimeMs)} - ${formatMilliseconds(result.endTimeMs)}`
                              : formatTime(result.timestamp)}
                          </p>
                        </div>

                        {result.rawFields && (
                          <div className="space-y-3">
                            {Object.entries(result.rawFields).map(([key, value]) => {
                              return (
                                <div key={key} className="mb-2">
                                  <span className="text-xs font-medium text-slate-500 uppercase">{key}</span>
                                  <p className="text-sm mt-1 whitespace-pre-wrap">{safeStringify(value)}</p>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Confidence section removed */}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-500 py-4">
                  {searchQuery ? "No results found" : "Enter a search query to find content in the video"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] border rounded-md p-3 mb-4 overflow-y-auto flex flex-col space-y-2">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-lg max-w-[80%] ${
                      msg.role === "user" ? "bg-primary text-primary-foreground self-end" : "bg-slate-100 self-start"
                    }`}
                  >
                    {msg.content}
                    {msg.role === "assistant" && msg.timestamp !== undefined && msg.timestamp !== null && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => seekToTimestamp(msg.timestamp, msg.videoUrl)}
                      >
                        Jump to {formatTime(msg.timestamp)}
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-500 my-auto">Send a message to start chatting</p>
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <Input
                type="text"
                placeholder="Type your message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1"
                disabled={!isSettingsComplete || isChatLoading}
              />
              <Button type="submit" disabled={!isSettingsComplete || isChatLoading}>
                {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

