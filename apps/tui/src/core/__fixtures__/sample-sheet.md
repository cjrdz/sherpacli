---
title: Sample
tags:
  - container
intro: |
  A tiny [sample](https://example.com) sheet.
---

## Getting started {.cols-2}

### Basics

Start a container in the background

```shell script
$ sample run -d -p 80:80 nginx
some output line
```

| Example                 | Description                    |
| ----------------------- | ------------------------------ |
| `sample ps -a`          | List **all** containers        |
| `sample logs [name]`    | Show logs<br>_(follow with -f)_ |
| `-d`                    | Detached flag only             |

| Description              | Example                |
| ------------------------ | ---------------------- |
| Remove a container       | `sample rm my-app`     |

### Cleanup

```bash
# Remove everything unused
sample system prune -a
sample rmi -f $(sample images -q) # Delete all images
```

```bash
sample get po -o wide
# Comment that follows its command
NAME="ignored assignment"
echo "$NAME" # => output, not a description
```

### Script {.row-span-2}

```bash
#!/bin/bash
echo "scripts are skipped"
```

```yaml
key: not a command
```

```shell script {.wrap}
$ sample inspect --format '{{.Name}}' my-app
```
