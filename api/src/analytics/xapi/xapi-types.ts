/**
 * xAPI 1.0.3 compatible TypeScript interfaces.
 * Pure types — no runtime dependencies.
 */

export interface XapiActor {
  objectType?: 'Agent' | 'Group';
  name?: string;
  mbox?: string;
  account?: {
    homePage: string;
    name: string;
  };
}

export interface XapiVerb {
  id: string;
  display?: Record<string, string>;
}

export interface XapiObject {
  objectType?: 'Activity' | 'Agent' | 'Group' | 'StatementRef' | 'SubStatement';
  id: string;
  definition?: {
    type?: string;
    name?: Record<string, string>;
    description?: Record<string, string>;
  };
}

export interface XapiResult {
  score?: {
    scaled?: number;
    raw?: number;
    min?: number;
    max?: number;
  };
  success?: boolean;
  completion?: boolean;
  duration?: string;
}

export interface XapiContext {
  registration?: string;
  contextActivities?: {
    parent?: XapiObject[];
    grouping?: XapiObject[];
    category?: XapiObject[];
  };
}

export interface XapiStatement {
  actor: XapiActor;
  verb: XapiVerb;
  object: XapiObject;
  result?: XapiResult;
  context?: XapiContext;
  timestamp?: string;
}
