# Owned manual-probe PTY only. No input text/prompt; only terminal query replies
# one fixed keep-existing-model choice, and two reviewed Ctrl+D presses. All native output is ephemeral pipe data.
import base64, fcntl, json, os, pty, select, signal, struct, sys, termios, time
pid, fd = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], sys.argv[1:])
alive = True
started = time.monotonic()
tail = b''
model_choice_sent = False
control_buffer = b''
try:
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 35, 120, 0, 0))
    print(json.dumps({'type': 'spawned', 'pid': pid}), flush=True)
    while alive and time.monotonic() - started < 25:
        ready, _, _ = select.select([fd, sys.stdin], [], [], .1)
        if fd in ready:
            try: chunk = os.read(fd, 8192)
            except OSError: chunk = b''
            if chunk:
                scan = tail + chunk
                if b'\x1b[6n' in scan:
                    os.write(fd, b'\x1b[1;1R')
                tail = scan[-3:]
                print(json.dumps({'type': 'output', 'bytes': base64.b64encode(chunk).decode()}), flush=True)
        if sys.stdin in ready:
            controls = os.read(0, 4096)
            control_buffer += controls
            lines = control_buffer.split(b'\n')
            control_buffer = lines.pop()
            if not controls: lines.append(b'')
            for raw_command in lines:
                command = raw_command.decode('ascii', errors='ignore').strip()
                if command == 'QUIT':
                    try:
                        os.write(fd, b'\x04')
                        time.sleep(.15)
                        os.write(fd, b'\x04')
                    except OSError:
                        pass  # A single press may already have exited the view.
                elif command == 'KEEP_MODEL' and not model_choice_sent:
                    model_choice_sent = True
                    # Native prompt discards queued input after its first draw.
                    time.sleep(.15)
                    os.write(fd, b'\x1b[B\r')
                elif command == 'TERM' or command == '':
                    os.kill(pid, signal.SIGTERM)
        done, status = os.waitpid(pid, os.WNOHANG)
        if done == pid:
            alive = False
            print(json.dumps({'type': 'exit', 'code': os.waitstatus_to_exitcode(status)}), flush=True)
finally:
    if alive:
        os.kill(pid, signal.SIGTERM)
        for _ in range(10):
            done, status = os.waitpid(pid, os.WNOHANG)
            if done == pid:
                alive = False
                break
            time.sleep(.1)
        if alive:
            os.kill(pid, signal.SIGKILL)
            _, status = os.waitpid(pid, 0)
        print(json.dumps({'type': 'cleanup-exit', 'code': os.waitstatus_to_exitcode(status)}), flush=True)
    os.close(fd)
