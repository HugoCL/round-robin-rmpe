"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;

let isOpen = false;
const listeners = new Set<Listener>();

function emit() {
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: Listener) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot() {
	return isOpen;
}

function getServerSnapshot() {
	return false;
}

export function openAgentSetupDialog() {
	isOpen = true;
	emit();
}

export function setAgentSetupDialogOpen(next: boolean) {
	isOpen = next;
	emit();
}

export function useAgentSetupDialogOpen() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
