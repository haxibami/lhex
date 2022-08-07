# lhex

**L**ib**H**oudini **EX**tractor

A deno script to extract libhoudini files from Windows Subsystem for Android™️ distribution, without running Windows

## Usage

### NOTE:

1. Runs only on Linux.
1. Requires `bsdtar`.
1. Asks for sudo permission while mounting `vendor.img`

### one-shot try

```sh
deno run -A https://github.com/haxibami/lhex/raw/main/cli.ts [args] [options]
```

### system install

```sh
deno install -Af --no-check --name=lhex https://github.com/haxibami/lhex/raw/main/cli.ts
```

### get libhoudini

```txt
> lhex --help

lhex - extract libhoudini from latest Windows Subsystem for Android package

Usage
  lhex <output directory> [options]

Options
  -h, --help                 Show this help message
  -v, --version              Show version
```

## how does it work?

1. fetch package metadata from [rg.store-adguard.net](https://store.rg-adguard.net/)
1. check metadata (if url suffix == `microsoft.com` or not)
1. download WSA package and check its sha-1 sum
1. unzip `.msixbundle` (which is just a `.zip`) and its child `.msix` (also a `.zip`) to get `vendor.img`
1. mount `vendor.img` and copy libhoudini files
