package lite

import "testing"

func TestToolDefinitionsExcludeRemovedSearch(t *testing.T) {
	tools := ToolDefinitions()
	if len(tools) == 0 {
		t.Fatal("expected retained tools")
	}

	for _, tool := range tools {
		switch tool.Name {
		case "search_tabs_content", "record_replay_flow_run", "record_replay_list_published":
			t.Fatalf("removed tool %q should not be registered", tool.Name)
		}
	}
}

func TestToolDefinitionsIncludeDebugTools(t *testing.T) {
	names := map[string]bool{}
	for _, tool := range ToolDefinitions() {
		names[tool.Name] = true
	}

	for _, name := range []string{
		"chrome_console",
		"chrome_network_capture",
		"performance_start_trace",
		"chrome_request_element_selection",
	} {
		if !names[name] {
			t.Fatalf("expected retained debug tool %q", name)
		}
	}
}
