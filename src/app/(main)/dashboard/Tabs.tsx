'use client';

import { useEffect, useId, useRef, useState } from 'react';

type Tab = { label: string; content: React.ReactNode };

type TabsControlledProps = {
  tabs: Tab[];
  activeTab: number;
  setActiveTab: (index: number) => void;
  onChange?: (index: number) => void;
};

type TabsUncontrolledProps = {
  tabs: Tab[];
  defaultActive?: number;
  onChange?: (index: number) => void;
};

type TabsProps = TabsControlledProps | TabsUncontrolledProps;

function isControlledProps(p: TabsProps): p is TabsControlledProps {
  return 'activeTab' in p;
}

export default function Tabs(props: TabsProps) {
  const { tabs } = props;
  const idPrefix = useId();
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const [internalActive, setInternalActive] = useState(
    !isControlledProps(props) ? props.defaultActive ?? 0 : 0
  );

  const activeIndex: number = isControlledProps(props)
    ? props.activeTab
    : internalActive;

  useEffect(() => {
    const el = tabsRef.current[activeIndex];
    if (el) el.focus();
  }, [activeIndex]);

  const setActive = (i: number) => {
    if (isControlledProps(props)) {
      props.setActiveTab(i);
    } else {
      setInternalActive(i);
    }
    props.onChange?.(i);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setActive(index === last ? 0 : index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setActive(index === 0 ? last : index - 1);
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(last);
        break;
    }
  };

  const setTabRef = (i: number) => (el: HTMLButtonElement | null) => {
    // callback ref deve retornar void
    tabsRef.current[i] = el;
  };

  return (
    <div>
      <div className="border-b border-dark-border">
        <nav
          className="-mb-px flex space-x-6 overflow-x-auto"
          role="tablist"
          aria-orientation="horizontal"
          aria-label="Abas"
        >
          {tabs.map((tab, index) => {
            const selected = activeIndex === index;
            const tabId = `${idPrefix}-tab-${index}`;
            const panelId = `${idPrefix}-panel-${index}`;
            return (
              <button
                key={tab.label}
                id={tabId}
                ref={setTabRef(index)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(e) => onKeyDown(e, index)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  selected
                    ? 'border-shopee-orange text-shopee-orange'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-text-secondary'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-6">
        {tabs.map((tab, index) => {
          const selected = activeIndex === index;
          const tabId = `${idPrefix}-tab-${index}`;
          const panelId = `${idPrefix}-panel-${index}`;
          return (
            <div
              key={panelId}
              id={panelId}
              role="tabpanel"
              aria-labelledby={tabId}
              hidden={!selected}
            >
              {selected ? tab.content : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
