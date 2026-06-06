type ShellCommandEnv = Record<string, string | undefined>;
type ShellCommandOutput = {
    errorOutput: string;
    exitCode: number | null;
    output: string;
    signalCode?: string;
};

export type ResolveShellCommandOptions = {
    cwd?: string;
    env?: ShellCommandEnv;
    includeStderrInErrors?: boolean;
    maxOutputBytes?: number;
    prefix?: string;
    shell?: readonly [string, ...string[]];
    stripFinalNewline?: boolean;
    timeoutMs?: number;
};

const DEFAULT_SHELL_COMMAND_PREFIX = "!";
const DEFAULT_SHELL_COMMAND_TIMEOUT_MS = 10_000;
const DEFAULT_SHELL_COMMAND_MAX_OUTPUT_BYTES = 16 * 1024;

function defaultShell(): readonly [string, ...string[]] {
    if (process.platform === "win32") {
        return ["cmd.exe", "/d", "/s", "/c"];
    }
    return ["/bin/sh", "-c"];
}

function stripFinalNewline(value: string): string {
    return value.replace(/\r?\n$/u, "");
}

function shellCommandValueError(message: string): Error {
    return new Error(`Shell command config value ${message}`);
}

function getCommand(value: string, prefix: string): string | undefined {
    if (!value.startsWith(prefix) || value.startsWith(prefix + prefix)) {
        return undefined;
    }

    const command = value.slice(prefix.length).trimStart();
    if (command.length === 0) {
        throw shellCommandValueError("is empty");
    }
    return command;
}

function getLiteralValue(value: string, prefix: string): string {
    if (value.startsWith(prefix + prefix)) {
        return value.slice(prefix.length);
    }
    return value;
}

async function readLimitedText(
    stream: ReadableStream<Uint8Array>,
    maxBytes: number,
): Promise<string> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        size += value.byteLength;
        if (size > maxBytes) {
            throw shellCommandValueError(
                `produced more than ${maxBytes} bytes`,
            );
        }
        chunks.push(value);
    }

    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(output);
}

async function runShellCommand(
    command: string,
    options: ResolveShellCommandOptions = {},
): Promise<ShellCommandOutput> {
    const proc = Bun.spawn({
        cmd: [...(options.shell ?? defaultShell()), command],
        cwd: options.cwd,
        env: options.env,
        stderr: "pipe",
        stdin: null,
        stdout: "pipe",
        timeout: options.timeoutMs ?? DEFAULT_SHELL_COMMAND_TIMEOUT_MS,
    });
    const stdout = readLimitedText(
        proc.stdout,
        options.maxOutputBytes ?? DEFAULT_SHELL_COMMAND_MAX_OUTPUT_BYTES,
    );
    const stderr = readLimitedText(
        proc.stderr,
        options.maxOutputBytes ?? DEFAULT_SHELL_COMMAND_MAX_OUTPUT_BYTES,
    );

    try {
        const [output, errorOutput, exitCode] = await Promise.all([
            stdout,
            stderr,
            proc.exited,
        ]);
        return {
            errorOutput,
            exitCode,
            output,
            signalCode: proc.signalCode ?? undefined,
        };
    } catch (err) {
        proc.kill();
        await Promise.allSettled([stdout, stderr, proc.exited]);
        throw err;
    }
}

function assertSuccessfulCommand(
    result: ShellCommandOutput,
    options: ResolveShellCommandOptions,
): void {
    if (result.exitCode === 0) {
        return;
    }

    const status =
        result.exitCode === null && result.signalCode
            ? `terminated by signal ${result.signalCode}`
            : `failed with exit code ${result.exitCode}`;
    const stderrDetails =
        options.includeStderrInErrors && result.errorOutput.trim().length > 0
            ? `: ${result.errorOutput.trim()}`
            : "";
    throw shellCommandValueError(`${status}${stderrDetails}`);
}

export async function resolveShellCommand(
    value: string,
    options: ResolveShellCommandOptions = {},
): Promise<string> {
    const prefix = options.prefix ?? DEFAULT_SHELL_COMMAND_PREFIX;
    if (prefix.length === 0) {
        throw new Error("Shell command prefix must not be empty");
    }

    const command = getCommand(value, prefix);
    if (!command) {
        return getLiteralValue(value, prefix);
    }

    const result = await runShellCommand(command, options);
    assertSuccessfulCommand(result, options);
    return (options.stripFinalNewline ?? true)
        ? stripFinalNewline(result.output)
        : result.output;
}
