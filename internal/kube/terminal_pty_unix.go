//go:build !windows

package kube

import (
	"context"
	"os"
	"os/exec"

	"github.com/creack/pty"
)

type unixPTY struct {
	cmd  *exec.Cmd
	ptmx *os.File
}

func startPTY(ctx context.Context, shell string, args, env []string, dir string, cols, rows uint16) (ptyProcess, error) {
	cmd := exec.CommandContext(ctx, shell, args...)
	cmd.Env = env
	cmd.Dir = dir
	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: cols, Rows: rows})
	if err != nil {
		return nil, err
	}
	return &unixPTY{cmd: cmd, ptmx: ptmx}, nil
}

func (p *unixPTY) Read(b []byte) (int, error)  { return p.ptmx.Read(b) }
func (p *unixPTY) Write(b []byte) (int, error) { return p.ptmx.Write(b) }
func (p *unixPTY) Close() error                { return p.ptmx.Close() }
func (p *unixPTY) Wait() error                 { return p.cmd.Wait() }
func (p *unixPTY) Kill() error                 { return p.cmd.Process.Kill() }

func (p *unixPTY) Resize(cols, rows uint16) error {
	return pty.Setsize(p.ptmx, &pty.Winsize{Cols: cols, Rows: rows})
}
