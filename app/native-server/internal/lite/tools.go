package lite

type ToolDefinition struct {
	Name        string
	Description string
	InputSchema map[string]any
}

func objectSchema(properties map[string]any, required ...string) map[string]any {
	schema := map[string]any{
		"type":       "object",
		"properties": properties,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

func ToolDefinitions() []ToolDefinition {
	anyObject := objectSchema(map[string]any{})

	return []ToolDefinition{
		{
			Name:        "get_windows_and_tabs",
			Description: "Get all currently open browser windows and tabs.",
			InputSchema: anyObject,
		},
		{
			Name:        "chrome_navigate",
			Description: "Navigate a tab to a URL, or open a URL in a new tab.",
			InputSchema: objectSchema(map[string]any{
				"url":    map[string]any{"type": "string"},
				"tabId":  map[string]any{"type": "number"},
				"newTab": map[string]any{"type": "boolean"},
			}, "url"),
		},
		{
			Name:        "chrome_switch_tab",
			Description: "Switch the active Chrome tab.",
			InputSchema: objectSchema(map[string]any{
				"tabId": map[string]any{"type": "number"},
			}, "tabId"),
		},
		{
			Name:        "chrome_close_tabs",
			Description: "Close one or more Chrome tabs.",
			InputSchema: objectSchema(map[string]any{
				"tabIds": map[string]any{"type": "array", "items": map[string]any{"type": "number"}},
			}, "tabIds"),
		},
		{
			Name:        "chrome_read_page",
			Description: "Read visible page structure and return accessibility-oriented element refs.",
			InputSchema: objectSchema(map[string]any{
				"tabId":  map[string]any{"type": "number"},
				"filter": map[string]any{"type": "string"},
				"depth":  map[string]any{"type": "number"},
				"refId":  map[string]any{"type": "string"},
			}),
		},
		{
			Name:        "chrome_computer",
			Description: "Use mouse, keyboard, scrolling, waiting, and screenshots against the browser.",
			InputSchema: objectSchema(map[string]any{
				"tabId":  map[string]any{"type": "number"},
				"action": map[string]any{"type": "string"},
			}, "action"),
		},
		{
			Name:        "chrome_screenshot",
			Description: "Capture a tab screenshot.",
			InputSchema: objectSchema(map[string]any{
				"tabId":      map[string]any{"type": "number"},
				"fullPage":   map[string]any{"type": "boolean"},
				"selector":   map[string]any{"type": "string"},
				"saveToFile": map[string]any{"type": "boolean"},
			}),
		},
		{
			Name:        "chrome_click_element",
			Description: "Click an element by selector or coordinates.",
			InputSchema: objectSchema(map[string]any{
				"tabId":       map[string]any{"type": "number"},
				"selector":    map[string]any{"type": "string"},
				"coordinates": map[string]any{"type": "object"},
			}),
		},
		{
			Name:        "chrome_fill_or_select",
			Description: "Fill an input or select an option.",
			InputSchema: objectSchema(map[string]any{
				"tabId":    map[string]any{"type": "number"},
				"selector": map[string]any{"type": "string"},
				"value":    map[string]any{"type": "string"},
			}, "selector", "value"),
		},
		{
			Name:        "chrome_keyboard",
			Description: "Send keyboard input or key chords to a tab.",
			InputSchema: objectSchema(map[string]any{
				"tabId": map[string]any{"type": "number"},
				"text":  map[string]any{"type": "string"},
			}, "text"),
		},
		{
			Name:        "chrome_get_web_content",
			Description: "Extract text or HTML content from a web page.",
			InputSchema: objectSchema(map[string]any{
				"tabId":  map[string]any{"type": "number"},
				"format": map[string]any{"type": "string"},
			}),
		},
		{
			Name:        "chrome_get_interactive_elements",
			Description: "List interactive elements from a web page.",
			InputSchema: objectSchema(map[string]any{
				"tabId": map[string]any{"type": "number"},
			}),
		},
		{
			Name:        "chrome_request_element_selection",
			Description: "Ask the user to pick an element in the current page.",
			InputSchema: objectSchema(map[string]any{
				"tabId": map[string]any{"type": "number"},
			}),
		},
		{
			Name:        "chrome_javascript",
			Description: "Evaluate JavaScript in a tab.",
			InputSchema: objectSchema(map[string]any{
				"tabId":  map[string]any{"type": "number"},
				"script": map[string]any{"type": "string"},
			}, "script"),
		},
		{
			Name:        "chrome_console",
			Description: "Read or clear browser console messages.",
			InputSchema: objectSchema(map[string]any{
				"tabId":  map[string]any{"type": "number"},
				"action": map[string]any{"type": "string"},
			}),
		},
		{
			Name:        "chrome_network_request",
			Description: "Send an HTTP request from the extension context.",
			InputSchema: objectSchema(map[string]any{
				"url":    map[string]any{"type": "string"},
				"method": map[string]any{"type": "string"},
				"body":   map[string]any{"type": "string"},
			}, "url"),
		},
		{
			Name:        "chrome_network_capture",
			Description: "Start, stop, or read network capture data.",
			InputSchema: objectSchema(map[string]any{
				"action": map[string]any{"type": "string"},
				"tabId":  map[string]any{"type": "number"},
			}, "action"),
		},
		{
			Name:        "performance_start_trace",
			Description: "Start a lightweight performance trace.",
			InputSchema: objectSchema(map[string]any{
				"reload":     map[string]any{"type": "boolean"},
				"autoStop":   map[string]any{"type": "boolean"},
				"durationMs": map[string]any{"type": "number"},
			}),
		},
		{
			Name:        "performance_stop_trace",
			Description: "Stop the active performance trace.",
			InputSchema: objectSchema(map[string]any{
				"saveToDownloads": map[string]any{"type": "boolean"},
				"filenamePrefix":  map[string]any{"type": "string"},
			}),
		},
		{
			Name:        "performance_analyze_insight",
			Description: "Return a lightweight summary of the last performance trace.",
			InputSchema: objectSchema(map[string]any{
				"insightName": map[string]any{"type": "string"},
			}),
		},
		{
			Name:        "chrome_upload_file",
			Description: "Set files on a file input.",
			InputSchema: objectSchema(map[string]any{
				"tabId":    map[string]any{"type": "number"},
				"selector": map[string]any{"type": "string"},
				"files":    map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			}, "selector", "files"),
		},
		{
			Name:        "chrome_handle_download",
			Description: "Inspect or manage recent Chrome downloads.",
			InputSchema: objectSchema(map[string]any{
				"action": map[string]any{"type": "string"},
			}, "action"),
		},
		{
			Name:        "chrome_handle_dialog",
			Description: "Handle JavaScript dialogs.",
			InputSchema: objectSchema(map[string]any{
				"tabId":  map[string]any{"type": "number"},
				"action": map[string]any{"type": "string"},
				"text":   map[string]any{"type": "string"},
			}, "action"),
		},
	}
}
