'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle, Loader2 } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (transcript: string) => void;
  onActionParsed?: (action: { type: string; title: string; date?: string; time?: string }) => void;
  placeholder?: string;
  className?: string;
  buttonText?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function VoiceInput({
  onTranscript,
  onActionParsed,
  placeholder = 'Speak to dictate...',
  className = '',
  buttonText,
  size = 'md',
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setIsSupported(false);
      }
    }
  }, []);

  const startListening = () => {
    setErrorMsg(null);
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setErrorMsg('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            interimTrans += event.results[i][0].transcript;
          }
        }

        if (interimTrans) {
          setInterimTranscript(interimTrans);
        }

        if (finalTrans) {
          const trimmed = finalTrans.trim();
          setInterimTranscript('');
          onTranscript(trimmed);
          setIsListening(false);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setErrorMsg('Microphone access denied. Please allow microphone permissions in your browser.');
        } else if (event.error === 'no-speech') {
          setErrorMsg('No speech detected. Please try speaking again.');
        } else {
          setErrorMsg(`Voice input error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      setErrorMsg('Could not initialize microphone speech recognition.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Failed to stop recognition cleanly:', e);
      }
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2.5 text-xs',
    lg: 'p-3 text-sm',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggleListening}
        className={`
          flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all shadow-sm
          ${sizeClasses[size]}
          ${
            isListening
              ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse ring-2 ring-rose-400'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }
        `}
        title={isListening ? 'Stop recording voice' : 'Click to speak with microphone'}
        aria-label="Toggle voice input microphone"
      >
        {isListening ? (
          <>
            <MicOff className={`${iconSizes[size]} text-white animate-spin`} />
            {buttonText ? (
              <span>Listening...</span>
            ) : (
              <span className="hidden sm:inline font-semibold">Listening...</span>
            )}
          </>
        ) : (
          <>
            <Mic className={iconSizes[size]} />
            {buttonText && <span>{buttonText}</span>}
          </>
        )}
      </button>

      {/* Interim Listening Tooltip Banner */}
      {isListening && interimTranscript && (
        <div className="absolute bottom-full mb-2 left-0 z-50 bg-slate-900 text-slate-100 text-xs px-3 py-1.5 rounded-lg shadow-lg border border-slate-700 whitespace-nowrap animate-in fade-in">
          <span className="text-indigo-400 font-semibold mr-1.5">Voice:</span> "{interimTranscript}"
        </div>
      )}

      {/* Error Toast Warning */}
      {errorMsg && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-rose-900/90 text-rose-100 text-xs p-2.5 rounded-lg shadow-xl border border-rose-700 max-w-xs flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{errorMsg}</p>
            {!isSupported && (
              <p className="text-[10px] text-rose-200 mt-1">
                Tip: You can still type directly into the text field.
              </p>
            )}
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-300 hover:text-white text-xs ml-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
