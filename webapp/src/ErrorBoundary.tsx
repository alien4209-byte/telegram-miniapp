import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorDisplay from '@/utils/ErrorDisplay';

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(_: Error): State {
		return { hasError: true };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error('Uncaught error:', error, errorInfo);
		// Here you would log the error to an error reporting service
	}

	render() {
		if (this.state.hasError) {
			return <ErrorDisplay message="error.unexpected" />;
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
