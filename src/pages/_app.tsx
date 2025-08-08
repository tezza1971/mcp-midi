import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { ErrorBoundary } from '../utils/ErrorBoundary';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary fallbackMessage="Something went wrong in the UI. Please restart the app or report this issue.">
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
