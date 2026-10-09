# Hugeicons tool to use premium icons

```bash
bun i
bun run build
npm i -g
```

Now you can use `ic` in your terminal.

```bash
ic icon-name
```

## Example

```bash
ic add-money-circle
```

## Configuration

hugeicons.config.json

```json
{
  "outputDir": "./src/assets/icons/hugeicons",
  "targetPlatform": "react-native",
  "defaultStrokeWidth": 1.5,
  "defaultColor": "currentColor",
  "defaultSize": 24,
  "defaultVariant": "stroke-rounded",
  "variants": ["stroke-rounded", "solid-rounded"]
}
```

It can work without config file also. It will take default values.
