#!/usr/bin/env python3
"""Replace hardcoded hex colors in SVGs with CSS variables."""
import re

COLOR_MAP = {
    # --- Surface / Background ---
    'ffffff': 'var(--diagram-surface-1)',
    'fff':    'var(--diagram-surface-1)',
    'f8f9fa': 'var(--diagram-surface-2)',
    'f8fafc': 'var(--diagram-surface-2)',
    'f1f5f9': 'var(--diagram-surface-3)',
    'fafafa': 'var(--diagram-surface-2)',

    # --- Stroke ---
    'bdbdbd': 'var(--diagram-stroke-1)',
    'e0e0e0': 'var(--diagram-stroke-2)',
    'cbd5e1': 'var(--diagram-stroke-1)',
    'e2e8f0': 'var(--diagram-stroke-2)',
    '9e9e9e': 'var(--diagram-stroke-1)',
    '795548': 'var(--diagram-stroke-1)',

    # --- Text ---
    '1e293b': 'var(--diagram-text-1)',
    '333333': 'var(--diagram-text-1)',
    '333':    'var(--diagram-text-1)',
    '64748b': 'var(--diagram-text-2)',
    '666666': 'var(--diagram-text-2)',
    '666':    'var(--diagram-text-2)',
    '777777': 'var(--diagram-text-3)',
    '777':    'var(--diagram-text-3)',
    '888888': 'var(--diagram-text-3)',
    '5d4037': 'var(--diagram-text-2)',

    # --- Arrow ---
    '475569': 'var(--diagram-arrow)',
    '555555': 'var(--diagram-arrow)',
    '555':    'var(--diagram-arrow)',

    # --- Ghost ---
    '999999': 'var(--diagram-ghost)',
    '999':    'var(--diagram-ghost)',

    # --- Accent 1 (Blue) ---
    '1565c0': 'var(--diagram-accent-1)',
    '3b82f6': 'var(--diagram-accent-1)',
    'e3f2fd': 'var(--diagram-accent-bg-1)',
    'dbeafe': 'var(--diagram-accent-bg-1)',
    'eff6ff': 'var(--diagram-accent-bg-1)',
    'bbdefb': 'var(--diagram-accent-bg-1b)',
    '90caf9': 'var(--diagram-accent-bg-1b)',
    'bfdbfe': 'var(--diagram-accent-bg-1b)',
    '0d47a1': 'var(--diagram-accent-text-1)',
    '1e40af': 'var(--diagram-accent-text-1)',
    '60a5fa': 'var(--diagram-accent-text-1)',

    # --- Accent 2 (Green) ---
    '2e7d32': 'var(--diagram-accent-2)',
    '16a34a': 'var(--diagram-accent-2)',
    '558b2f': 'var(--diagram-accent-2)',
    'e8f5e9': 'var(--diagram-accent-bg-2)',
    'dcfce7': 'var(--diagram-accent-bg-2)',
    'f0fdf4': 'var(--diagram-accent-bg-2)',
    'f1f8e9': 'var(--diagram-accent-bg-2)',
    'c8e6c9': 'var(--diagram-accent-bg-2b)',
    'bbf7d0': 'var(--diagram-accent-bg-2b)',
    'a5d6a7': 'var(--diagram-accent-bg-2b)',
    '1b5e20': 'var(--diagram-accent-text-2)',
    '166534': 'var(--diagram-accent-text-2)',
    '4ade80': 'var(--diagram-accent-text-2)',

    # --- Accent 3 (Purple) ---
    '7b1fa2': 'var(--diagram-accent-3)',
    '6a1b9a': 'var(--diagram-accent-3)',
    '9c27b0': 'var(--diagram-accent-3)',
    '3f51b5': 'var(--diagram-accent-3)',
    'f3e5f5': 'var(--diagram-accent-bg-3)',
    'e1bee7': 'var(--diagram-accent-bg-3b)',
    'c5cae9': 'var(--diagram-accent-bg-3)',
    '4a148c': 'var(--diagram-accent-text-3)',
    '1a237e': 'var(--diagram-accent-text-3)',
    '8b5cf6': 'var(--diagram-accent-text-3)',

    # --- Accent 4 (Orange) ---
    'e65100': 'var(--diagram-accent-4)',
    'f59e0b': 'var(--diagram-accent-4)',
    'f9a825': 'var(--diagram-accent-4)',
    'ff9800': 'var(--diagram-accent-4)',
    'fff3e0': 'var(--diagram-accent-bg-4)',
    'fef3c7': 'var(--diagram-accent-bg-4)',
    'ffe0b2': 'var(--diagram-accent-bg-4)',
    'fff9c4': 'var(--diagram-accent-bg-4)',
    'bf360c': 'var(--diagram-accent-text-4)',
    '92400e': 'var(--diagram-accent-text-4)',
    'f57f17': 'var(--diagram-accent-text-4)',
    'fbbf24': 'var(--diagram-accent-text-4)',

    # --- Accent 5 (Red) ---
    'c62828': 'var(--diagram-accent-5)',
    'ef4444': 'var(--diagram-accent-5)',
    'ffebee': 'var(--diagram-accent-bg-5)',
    'ffcdd2': 'var(--diagram-accent-bg-5)',
    'fef2f2': 'var(--diagram-accent-bg-5)',
    'ef9a9a': 'var(--diagram-accent-bg-5)',
    'b71c1c': 'var(--diagram-accent-text-5)',

    # --- Pink → accent-5 variant ---
    'ec4899': 'var(--diagram-accent-5)',
    'fce7f3': 'var(--diagram-accent-bg-5)',
    'f472b6': 'var(--diagram-accent-text-5)',
    '9d174d': 'var(--diagram-accent-text-5)',

    # --- Brown → surface/text ---
    'efebe9': 'var(--diagram-surface-3)',

    # --- Additional purples/indigos ---
    '94a3b8': 'var(--diagram-ghost)',       # slate gray (disabled/unavailable)
    'ede7f6': 'var(--diagram-accent-bg-3)', # light purple
    'e8eaf6': 'var(--diagram-accent-bg-3)', # light indigo
    '512da8': 'var(--diagram-accent-3)',    # dark purple
    '9575cd': 'var(--diagram-accent-bg-3b)', # medium purple
    '7e57c2': 'var(--diagram-accent-text-3)', # medium purple text
    '5c6bc0': 'var(--diagram-accent-3)',    # medium indigo
    '283593': 'var(--diagram-accent-text-3)', # dark indigo text

    # --- Additional orange variants ---
    'ffcc80': 'var(--diagram-accent-bg-4)', # light orange
    'fffbeb': 'var(--diagram-accent-bg-4)', # warm white/amber

    # --- Additional pink/red variants ---
    'fce4ec': 'var(--diagram-accent-bg-5)', # light pink
}

FILES = [
    'tcp-segment.svg',
    'tcp-congestion.svg',
    'tcp-handshake.svg',
    'tcp-window.svg',
    'tcp-sticky-packet.svg',
    'netty-reactor.svg',
    'http-evolution.svg',
    'http-message-format.svg',
    'http-quic-stack.svg',
    'http-status-decision.svg',
    'http2-multiplex.svg',
    'arch-evolution.svg',
    'hexagonal-arch.svg',
]

pattern = re.compile(r'(fill|stroke)="([^"]+)"')

def process_file(fname):
    try:
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"SKIP: {fname} not found")
        return 0

    count = [0]

    def replacer(m):
        attr, value = m.group(1), m.group(2)
        if 'var(--' in value:
            return m.group(0)
        if not value.startswith('#'):
            return m.group(0)
        hex_val = value[1:].lower()
        if hex_val in COLOR_MAP:
            count[0] += 1
            return f'{attr}="{COLOR_MAP[hex_val]}"'
        return m.group(0)

    new_content = pattern.sub(replacer, content)
    if new_content != content:
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"✅ {fname}: {count[0]} replacements")
    else:
        print(f"⏭️  {fname}: no changes")
    return count[0]

total = 0
for f in FILES:
    total += process_file(f)
print(f"\nTotal: {total} replacements")
