# Component Test Patterns

Test suite structures for Simple and Complex components using Vitest Browser Mode.

## Simple Component Test Suite

For components with visual props, no internal state management, and straightforward behavior.

### Structure

```tsx
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expect, describe, it, vi } from 'vitest' // omit if vitest/globals configured
import { createRef } from 'react'
import { ComponentName } from './ComponentName'

describe('ComponentName', () => {
  describe('Rendering and Props', () => {
    it('should render with default props', async () => {
      await render(<ComponentName>Content</ComponentName>)
      await expect.element(page.getByText('Content')).toBeVisible()
    })

    it('should forward ref', async () => {
      const ref = createRef<HTMLElement>()
      await render(<ComponentName ref={ref}>Content</ComponentName>)
      expect(ref.current).toBeInstanceOf(HTMLElement)
    })
  })

  // Optional: If component supports 'as' prop
  describe('Polymorphic Component', () => {
    it('should render as different element via "as" prop', async () => {
      await render(<ComponentName as="span">Content</ComponentName>)
      const element = page.getByText('Content')
      await expect.element(element).toBeVisible()
      // Verify element type if needed
    })
  })

  describe('Edge Cases', () => {
    it('should render without children', async () => {
      await render(<ComponentName />)
      // Component should render without error
    })

    it('should handle long text content', async () => {
      const longText = 'A'.repeat(200)
      await render(<ComponentName>{longText}</ComponentName>)
      await expect.element(page.getByText(longText)).toBeVisible()
    })
  })
})
```

### Common Patterns

**Button Component:**
```tsx
describe('Button', () => {
  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn()
    await render(<Button onClick={handleClick}>Click me</Button>)
    await page.getByRole('button', { name: 'Click me' }).click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should be disabled when disabled prop is true', async () => {
    await render(<Button disabled>Click me</Button>)
    await expect.element(page.getByRole('button')).toBeDisabled()
  })

  it('should show loading state', async () => {
    await render(<Button loading>Click me</Button>)
    await expect.element(page.getByRole('button')).toBeDisabled()
    // Check for loading indicator
  })
})
```

**Badge/Tag Component:**
```tsx
describe('Badge', () => {
  it('should render with label', async () => {
    await render(<Badge>New</Badge>)
    await expect.element(page.getByText('New')).toBeVisible()
  })

  it('should apply color variant', async () => {
    await render(<Badge color="success">Success</Badge>)
    await expect.element(page.getByText('Success')).toBeVisible()
  })

  it('should be removable when onRemove provided', async () => {
    const onRemove = vi.fn()
    await render(<Badge onRemove={onRemove}>Tag</Badge>)
    await page.getByRole('button').click()
    expect(onRemove).toHaveBeenCalled()
  })
})
```

---

## Complex Component Test Suite

For components with compound patterns, controlled/uncontrolled state, popups, or complex interactions.

### CenteredWrapper

Always use for complex components in browser tests:

```tsx
const CenteredWrapper = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
    }}
  >
    {children}
  </div>
)
```

### Structure

```tsx
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expect, describe, it, vi, beforeEach } from 'vitest' // omit if vitest/globals configured
import { useState, createRef } from 'react'
import { ComponentName } from './ComponentName'

const CenteredWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
    {children}
  </div>
)

describe('ComponentName', () => {
  describe('Rendering and Props', () => {
    it('should render compound components', async () => {
      await render(
        <CenteredWrapper>
          <ComponentName>
            <ComponentName.Trigger>Open</ComponentName.Trigger>
            <ComponentName.Content>Content</ComponentName.Content>
          </ComponentName>
        </CenteredWrapper>
      )
      await expect.element(page.getByRole('button', { name: 'Open' })).toBeVisible()
    })

    it('should forward ref', async () => {
      const ref = createRef<HTMLElement>()
      await render(
        <CenteredWrapper>
          <ComponentName ref={ref}>
            <ComponentName.Trigger>Open</ComponentName.Trigger>
          </ComponentName>
        </CenteredWrapper>
      )
      expect(ref.current).toBeInstanceOf(HTMLElement)
    })
  })

  describe('Popup Open/Close', () => {
    it('should open on trigger click', async () => {
      await render(
        <CenteredWrapper>
          <ComponentName>
            <ComponentName.Trigger>Open</ComponentName.Trigger>
            <ComponentName.Content>Content here</ComponentName.Content>
          </ComponentName>
        </CenteredWrapper>
      )
      await page.getByRole('button', { name: 'Open' }).click()
      await expect.element(page.getByText('Content here')).toBeVisible()
    })

    it('should close on Escape key', async () => {
      await render(
        <CenteredWrapper>
          <ComponentName defaultOpen>
            <ComponentName.Trigger>Open</ComponentName.Trigger>
            <ComponentName.Content>Content here</ComponentName.Content>
          </ComponentName>
        </CenteredWrapper>
      )
      await expect.element(page.getByText('Content here')).toBeVisible()
      await userEvent.keyboard('{Escape}')
      await expect.element(page.getByText('Content here')).not.toBeInTheDocument()
    })

    it('should close on outside click', async () => {
      await render(
        <CenteredWrapper>
          <ComponentName defaultOpen>
            <ComponentName.Trigger>Open</ComponentName.Trigger>
            <ComponentName.Content>Content here</ComponentName.Content>
          </ComponentName>
        </CenteredWrapper>
      )
      await expect.element(page.getByText('Content here')).toBeVisible()
      // Click outside (on the wrapper)
      await page.getByText('Content here').click({ position: { x: -100, y: -100 } })
      // Or use document body click
    })
  })

  describe('State Management', () => {
    it('should work with defaultValue (uncontrolled)', async () => {
      await render(
        <CenteredWrapper>
          <ComponentName defaultValue="option1">
            <ComponentName.Trigger />
            <ComponentName.Content>
              <ComponentName.Item value="option1">Option 1</ComponentName.Item>
              <ComponentName.Item value="option2">Option 2</ComponentName.Item>
            </ComponentName.Content>
          </ComponentName>
        </CenteredWrapper>
      )
      // Verify default value is selected
      await expect.element(page.getByRole('button')).toHaveTextContent('Option 1')
    })

    it('should work with value + onChange (controlled)', async () => {
      const ControlledComponent = () => {
        const [value, setValue] = useState('option1')
        return (
          <ComponentName value={value} onValueChange={setValue}>
            <ComponentName.Trigger />
            <ComponentName.Content>
              <ComponentName.Item value="option1">Option 1</ComponentName.Item>
              <ComponentName.Item value="option2">Option 2</ComponentName.Item>
            </ComponentName.Content>
          </ComponentName>
        )
      }

      await render(
        <CenteredWrapper>
          <ControlledComponent />
        </CenteredWrapper>
      )

      await page.getByRole('button').click()
      await page.getByRole('option', { name: 'Option 2' }).click()
      await expect.element(page.getByRole('button')).toHaveTextContent('Option 2')
    })
  })

  describe('User Interactions', () => {
    it('should navigate with keyboard', async () => {
      await render(
        <CenteredWrapper>
          <ComponentName>
            <ComponentName.Trigger>Open</ComponentName.Trigger>
            <ComponentName.Content>
              <ComponentName.Item value="a">Item A</ComponentName.Item>
              <ComponentName.Item value="b">Item B</ComponentName.Item>
            </ComponentName.Content>
          </ComponentName>
        </CenteredWrapper>
      )

      await page.getByRole('button', { name: 'Open' }).click()
      await userEvent.keyboard('{ArrowDown}')
      await userEvent.keyboard('{Enter}')
      // Verify selection
    })

    it('should handle click selection', async () => {
      const onValueChange = vi.fn()
      await render(
        <CenteredWrapper>
          <ComponentName onValueChange={onValueChange}>
            <ComponentName.Trigger>Open</ComponentName.Trigger>
            <ComponentName.Content>
              <ComponentName.Item value="selected">Select me</ComponentName.Item>
            </ComponentName.Content>
          </ComponentName>
        </CenteredWrapper>
      )

      await page.getByRole('button', { name: 'Open' }).click()
      await page.getByRole('option', { name: 'Select me' }).click()
      expect(onValueChange).toHaveBeenCalledWith('selected')
    })
  })

  describe('Validation', () => {
    it('should show error for invalid value', async () => {
      await render(
        <CenteredWrapper>
          <ComponentName required error="This field is required">
            <ComponentName.Trigger>Select...</ComponentName.Trigger>
          </ComponentName>
        </CenteredWrapper>
      )
      await expect.element(page.getByText('This field is required')).toBeVisible()
    })

    it('should call validate function', async () => {
      const validate = vi.fn().mockReturnValue('Invalid selection')
      await render(
        <CenteredWrapper>
          <ComponentName validate={validate} defaultValue="test">
            <ComponentName.Trigger />
          </ComponentName>
        </CenteredWrapper>
      )
      expect(validate).toHaveBeenCalledWith('test')
    })
  })

  describe('Edge Cases', () => {
    it('should handle null/undefined value', async () => {
      await render(
        <CenteredWrapper>
          <ComponentName value={undefined}>
            <ComponentName.Trigger>Select...</ComponentName.Trigger>
          </ComponentName>
        </CenteredWrapper>
      )
      await expect.element(page.getByRole('button')).toHaveTextContent('Select...')
    })

    it('should work when disabled', async () => {
      await render(
        <CenteredWrapper>
          <ComponentName disabled>
            <ComponentName.Trigger>Disabled</ComponentName.Trigger>
          </ComponentName>
        </CenteredWrapper>
      )
      await expect.element(page.getByRole('button')).toBeDisabled()
    })

    it('should handle rapid interactions', async () => {
      await render(
        <CenteredWrapper>
          <ComponentName>
            <ComponentName.Trigger>Open</ComponentName.Trigger>
            <ComponentName.Content>Content</ComponentName.Content>
          </ComponentName>
        </CenteredWrapper>
      )

      // Rapid open/close
      await page.getByRole('button', { name: 'Open' }).click()
      await page.getByRole('button', { name: 'Open' }).click()
      // Component should handle gracefully
    })
  })
})
```

---

## Specific Component Patterns

### Select/Combobox

```tsx
describe('Select', () => {
  it('should filter options on search', async () => {
    await render(
      <CenteredWrapper>
        <Select searchable>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
            <Select.Item value="cherry">Cherry</Select.Item>
          </Select.Content>
        </Select>
      </CenteredWrapper>
    )

    await page.getByRole('combobox').click()
    await page.getByRole('combobox').fill('ban')

    await expect.element(page.getByRole('option', { name: 'Banana' })).toBeVisible()
    await expect.element(page.getByRole('option', { name: 'Apple' })).not.toBeInTheDocument()
  })

  it('should support multi-select', async () => {
    const onChange = vi.fn()
    await render(
      <CenteredWrapper>
        <Select multiple onValueChange={onChange}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="a">A</Select.Item>
            <Select.Item value="b">B</Select.Item>
          </Select.Content>
        </Select>
      </CenteredWrapper>
    )

    await page.getByRole('button').click()
    await page.getByRole('option', { name: 'A' }).click()
    await page.getByRole('option', { name: 'B' }).click()

    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
  })
})
```

### Dialog/Modal

```tsx
describe('Dialog', () => {
  it('should trap focus within dialog', async () => {
    await render(
      <CenteredWrapper>
        <Dialog open>
          <Dialog.Content>
            <Dialog.Title>Title</Dialog.Title>
            <input data-testid="input1" />
            <button>Action</button>
          </Dialog.Content>
        </Dialog>
      </CenteredWrapper>
    )

    // First focusable should have focus
    await expect.element(page.getByTestId('input1')).toHaveFocus()

    // Tab should cycle within dialog
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'Action' })).toHaveFocus()
  })

  it('should call onOpenChange when closed', async () => {
    const onOpenChange = vi.fn()
    await render(
      <CenteredWrapper>
        <Dialog open onOpenChange={onOpenChange}>
          <Dialog.Content>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Content>
        </Dialog>
      </CenteredWrapper>
    )

    await page.getByRole('button', { name: 'Close' }).click()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
```

### Tabs

```tsx
describe('Tabs', () => {
  it('should switch tabs on click', async () => {
    await render(
      <CenteredWrapper>
        <Tabs defaultValue="tab1">
          <Tabs.List>
            <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
            <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="tab1">Content 1</Tabs.Content>
          <Tabs.Content value="tab2">Content 2</Tabs.Content>
        </Tabs>
      </CenteredWrapper>
    )

    await expect.element(page.getByText('Content 1')).toBeVisible()
    await page.getByRole('tab', { name: 'Tab 2' }).click()
    await expect.element(page.getByText('Content 2')).toBeVisible()
    await expect.element(page.getByText('Content 1')).not.toBeVisible()
  })

  it('should navigate tabs with arrow keys', async () => {
    await render(
      <CenteredWrapper>
        <Tabs defaultValue="tab1">
          <Tabs.List>
            <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
            <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </CenteredWrapper>
    )

    await page.getByRole('tab', { name: 'Tab 1' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(page.getByRole('tab', { name: 'Tab 2' })).toHaveFocus()
  })
})
```

### DatePicker

```tsx
describe('DatePicker', () => {
  it('should open calendar on trigger click', async () => {
    await render(
      <CenteredWrapper>
        <DatePicker>
          <DatePicker.Trigger>Select date</DatePicker.Trigger>
          <DatePicker.Calendar />
        </DatePicker>
      </CenteredWrapper>
    )

    await page.getByRole('button', { name: 'Select date' }).click()
    await expect.element(page.getByRole('grid')).toBeVisible()
  })

  it('should select a date', async () => {
    const onChange = vi.fn()
    await render(
      <CenteredWrapper>
        <DatePicker onValueChange={onChange}>
          <DatePicker.Trigger>Select date</DatePicker.Trigger>
          <DatePicker.Calendar />
        </DatePicker>
      </CenteredWrapper>
    )

    await page.getByRole('button', { name: 'Select date' }).click()
    await page.getByRole('gridcell', { name: '15' }).click()

    expect(onChange).toHaveBeenCalled()
  })

  it('should disable dates before minDate', async () => {
    const minDate = new Date(2024, 0, 15)
    await render(
      <CenteredWrapper>
        <DatePicker minDate={minDate} defaultOpen>
          <DatePicker.Trigger>Select date</DatePicker.Trigger>
          <DatePicker.Calendar />
        </DatePicker>
      </CenteredWrapper>
    )

    await expect.element(page.getByRole('gridcell', { name: '14' })).toBeDisabled()
    await expect.element(page.getByRole('gridcell', { name: '15' })).toBeEnabled()
  })
})
```

### FileUpload

```tsx
describe('FileUpload', () => {
  it('should accept file via input', async () => {
    const onFileSelect = vi.fn()
    await render(
      <CenteredWrapper>
        <FileUpload onFileSelect={onFileSelect}>
          <FileUpload.Trigger>Upload</FileUpload.Trigger>
        </FileUpload>
      </CenteredWrapper>
    )

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    const input = page.getByRole('button', { name: 'Upload' })
      .element()
      .querySelector('input[type="file"]')

    // Trigger file selection
    Object.defineProperty(input, 'files', { value: [file] })
    input?.dispatchEvent(new Event('change', { bubbles: true }))

    expect(onFileSelect).toHaveBeenCalledWith([file])
  })

  it('should validate file type', async () => {
    const onError = vi.fn()
    await render(
      <CenteredWrapper>
        <FileUpload accept=".pdf" onError={onError}>
          <FileUpload.Trigger>Upload PDF</FileUpload.Trigger>
        </FileUpload>
      </CenteredWrapper>
    )

    // Attempt to upload invalid file type
    // Verify error callback
  })

  it('should show file preview', async () => {
    await render(
      <CenteredWrapper>
        <FileUpload defaultFiles={[{ name: 'test.pdf', size: 1024 }]}>
          <FileUpload.Trigger>Upload</FileUpload.Trigger>
          <FileUpload.Preview />
        </FileUpload>
      </CenteredWrapper>
    )

    await expect.element(page.getByText('test.pdf')).toBeVisible()
  })
})
```

---

## Best Practices Summary

1. **Always use CenteredWrapper** for complex components
2. **Prefer role-based queries** (`getByRole`) over test IDs
3. **Use `await expect.element()`** for auto-retry assertions
4. **Test controlled + uncontrolled** state patterns
5. **Cover keyboard navigation** for accessibility
6. **Test edge cases**: null values, disabled states, rapid interactions
7. **Mock callbacks with `vi.fn()`** to verify behavior
8. **Use descriptive test names** that explain the expected behavior
