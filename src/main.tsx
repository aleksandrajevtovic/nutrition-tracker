import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import ToastProvider from './components/ToastProvider';
import UnsavedChangesProvider from './components/UnsavedChangesProvider';
import './style.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><ToastProvider><UnsavedChangesProvider><App/></UnsavedChangesProvider></ToastProvider></React.StrictMode>);
