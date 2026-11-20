<#
.SYNOPSIS
  Creates an "Aetheria Chronicles" shortcut on your Windows desktop.

.DESCRIPTION
  Points at release\win-unpacked\Aetheria Chronicles.exe when the desktop build exists,
  otherwise at Launch-Aetheria-Desktop.bat (which builds the app on first run).
  Uses the Unicode shell-link API (IShellLinkW), so it also works when the Desktop folder
  has a non-English name or lives in OneDrive. Use -StartMenu to also add a Start Menu entry.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Create-Desktop-Shortcut.ps1
#>
[CmdletBinding()]
param(
  [switch]$StartMenu
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $root 'release\win-unpacked\Aetheria Chronicles.exe'
$launcher = Join-Path $root 'Launch-Aetheria-Desktop.bat'
$iconFile = Join-Path $root 'build\icon.ico'

if (Test-Path -LiteralPath $exe) {
  $target = $exe
  $iconPath = $exe
} else {
  $target = $launcher
  $iconPath = if (Test-Path -LiteralPath $iconFile) { $iconFile } else { "$env:SystemRoot\System32\shell32.dll" }
  Write-Host 'Desktop build not found yet - the shortcut will run Launch-Aetheria-Desktop.bat, which builds it on first launch.'
}

if (-not ('AetheriaShortcut' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
class AetheriaShellLinkCoClass { }

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
interface IAetheriaShellLinkW {
  void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cch, IntPtr pfd, int fFlags);
  void GetIDList(out IntPtr ppidl);
  void SetIDList(IntPtr pidl);
  void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cch);
  void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
  void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cch);
  void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
  void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cch);
  void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
  void GetHotkey(out short pwHotkey);
  void SetHotkey(short wHotkey);
  void GetShowCmd(out int piShowCmd);
  void SetShowCmd(int iShowCmd);
  void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cch, out int piIcon);
  void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
  void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
  void Resolve(IntPtr hwnd, int fFlags);
  void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
}

public static class AetheriaShortcut {
  public static void Create(string lnkPath, string target, string workDir, string iconPath, int iconIndex, string description) {
    IAetheriaShellLinkW link = (IAetheriaShellLinkW)new AetheriaShellLinkCoClass();
    link.SetPath(target);
    link.SetWorkingDirectory(workDir);
    link.SetIconLocation(iconPath, iconIndex);
    link.SetDescription(description);
    ((IPersistFile)link).Save(lnkPath, true);
    Marshal.ReleaseComObject(link);
  }
}
'@
}

function New-AetheriaShortcut([string]$folder) {
  if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
  $lnkPath = Join-Path $folder 'Aetheria Chronicles.lnk'
  [AetheriaShortcut]::Create($lnkPath, $target, (Split-Path -Parent $target), $iconPath, 0, 'Aetheria Chronicles: Sword & Forge - Full-Dive Desktop Edition')
  Write-Host "Shortcut created: $lnkPath"
  Write-Host "  -> $target"
}

New-AetheriaShortcut ([Environment]::GetFolderPath('Desktop'))
if ($StartMenu) {
  New-AetheriaShortcut ([Environment]::GetFolderPath('Programs'))
}
