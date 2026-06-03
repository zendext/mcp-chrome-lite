import type { ToolResult } from '@/common/tool-handler';
import { createErrorResponse } from '@/common/tool-handler';

import { navigateTool, closeTabsTool, switchTabTool } from '../tools/browser/common';
import { windowTool } from '../tools/browser/window';
import { screenshotTool } from '../tools/browser/screenshot';
import { webFetcherTool, getInteractiveElementsTool } from '../tools/browser/web-fetcher';
import { clickTool, fillTool } from '../tools/browser/interaction';
import { elementPickerTool } from '../tools/browser/element-picker';
import { networkRequestTool } from '../tools/browser/network-request';
import { networkCaptureTool } from '../tools/browser/network-capture';
import { keyboardTool } from '../tools/browser/keyboard';
import { javascriptTool } from '../tools/browser/javascript';
import { consoleTool } from '../tools/browser/console';
import { fileUploadTool } from '../tools/browser/file-upload';
import { readPageTool } from '../tools/browser/read-page';
import { computerTool } from '../tools/browser/computer';
import { handleDialogTool } from '../tools/browser/dialog';
import { handleDownloadTool } from '../tools/browser/download';
import {
  performanceStartTraceTool,
  performanceStopTraceTool,
  performanceAnalyzeInsightTool,
} from '../tools/browser/performance';

export interface DispatchRequest {
  name: string;
  args: unknown;
}

export interface DispatchResponse {
  status: 'success' | 'error';
  result?: ToolResult;
  error?: string;
}

const retainedTools = [
  windowTool,
  navigateTool,
  switchTabTool,
  closeTabsTool,
  readPageTool,
  computerTool,
  screenshotTool,
  clickTool,
  fillTool,
  keyboardTool,
  webFetcherTool,
  getInteractiveElementsTool,
  elementPickerTool,
  javascriptTool,
  consoleTool,
  networkRequestTool,
  networkCaptureTool,
  performanceStartTraceTool,
  performanceStopTraceTool,
  performanceAnalyzeInsightTool,
  fileUploadTool,
  handleDownloadTool,
  handleDialogTool,
];

interface LiteToolExecutor {
  name: string;
  execute(args: unknown): Promise<ToolResult>;
}

const retainedToolMap = new Map<string, LiteToolExecutor>(
  retainedTools.map((tool) => [tool.name, tool as LiteToolExecutor]),
);

export async function dispatchTool(request: DispatchRequest): Promise<DispatchResponse> {
  const tool = retainedToolMap.get(request.name);
  if (!tool) {
    const message = `Tool ${request.name} is not registered in mcp-chrome-lite`;
    return {
      status: 'error',
      error: message,
      result: createErrorResponse(message),
    };
  }

  try {
    const result = await tool.execute(request.args);
    return { status: 'success', result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'error',
      error: message,
      result: createErrorResponse(message),
    };
  }
}
