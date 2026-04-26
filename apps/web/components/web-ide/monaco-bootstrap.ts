'use client';

/**
 * Load Monaco from `node_modules` instead of the default CDN so the editor
 * initializes on localhost / strict networks (avoids infinite "Loading editor…").
 */
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

if (typeof window !== 'undefined') {
  loader.config({ monaco });
}
