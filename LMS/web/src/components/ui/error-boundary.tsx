"use client";

import React from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <TriangleAlert
            aria-hidden
            className="h-12 w-12 mb-4 text-[var(--color-danger)]"
          />
          <h2 className="text-xl font-semibold mb-2 text-[var(--color-foreground)]">
            Something went wrong
          </h2>
          <p className="text-[var(--color-muted-foreground)] mb-4 text-center max-w-md">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
