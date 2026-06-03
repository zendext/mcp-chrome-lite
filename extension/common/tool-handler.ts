export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface ToolResult {
  content: (TextContent | ImageContent)[];
  isError: boolean;
}

export interface ToolExecutor {
  execute(args: any): Promise<ToolResult>;
}

export const createErrorResponse = (
  message: string = 'Unknown error, please try again',
): ToolResult => {
  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
    isError: true,
  };
};
