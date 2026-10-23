---
name: matchbox-native-fusion
description: "Use this skill when writing Rust for MatchBox Native Fusion: exposing Rust functions as BoxLang BIFs with #[matchbox_fn], Rust structs as native objects with #[matchbox_class] and #[matchbox_methods], register_bifs and register_classes, native/Cargo.toml crates, and Rust code that calls back into BoxLang functions through the BxVM trait."
---

# MatchBox Native Fusion

> BoxLang is the AI-native software productivity platform for building, modernizing and running applications, with developers and AI agents working together.

## Overview

Native Fusion lets you write Rust and call it from BoxLang, and lets that Rust call back into BoxLang. Everything is statically linked into one binary.

- **Native builds only** (`--target native`). Not available for js, wasm, wasi or esp32.
- A native build goes through cargo, so it is larger and slower to build than the plain runner stub.
- `matchbox app.bxs` (interpreted) does **not** know your Rust BIFs. Calling one there fails (for example `Can only call functions`). Build with `--target native` and run the binary.

Reference: the MatchBox repo `docs/building-and-deploying/native-fusion.md` and the runnable `docs/examples/native_fusion` example.

---

## Project Layout

```
my_app/
├── app.bxs            # BoxLang entry point
└── native/
    ├── Cargo.toml     # optional, for extra crates
    ├── math.rs        # exports register_bifs()
    └── counter.rs     # exports register_bifs() and/or register_classes()
```

```bash
matchbox --target native app.bxs   # compiles native/*.rs with the VM, writes ./app
./app
```

BIF and class names must be unique across all files in `native/`.

---

## Functions: `#[matchbox_fn]`

```rust
// native/math.rs
use matchbox_vm::{matchbox_fn, types::BxNativeFunction};
use std::collections::HashMap;

#[matchbox_fn]
pub fn add( a: f64, b: f64 ) -> f64 { a + b }

pub fn register_bifs() -> HashMap<String, BxNativeFunction> {
	let mut map = HashMap::new();
	// Register the generated wrapper, not the original function.
	map.insert( "add".to_string(), add_wrapper as BxNativeFunction );
	map
}
```

```js
println( add( 10, 20 ) ); // 30
```

Parameter types the macro converts: `f64`, `i32`, `bool`, `String` and `BxValue` (passed through). The return value is wrapped as a number, so for strings, null or objects write a manual BIF. Return a string with `BxValue::new_ptr( vm.string_new( text ) )` (there is no `BxValue::new_string`).

### Manual BIF signature

```rust
use matchbox_vm::types::{BxNativeFunction, BxValue, BxVM};

pub fn greet( vm: &mut dyn BxVM, args: &[BxValue] ) -> Result<BxValue, String> {
	if args.is_empty() {
		return Err( "greet: expected one argument".to_string() );
	}
	let name = vm.to_string( args[0] );
	Ok( BxValue::new_ptr( vm.string_new( format!( "Hello, {}!", name ) ) ) )
}
```

Register it in `register_bifs()` with `greet as BxNativeFunction`.

---

## Objects: `#[matchbox_class]` + `#[matchbox_methods]`

```rust
// native/counter.rs
use matchbox_vm::{matchbox_class, matchbox_methods, types::{BxNativeFunction, BxValue, BxVM}};
use std::{cell::RefCell, collections::HashMap, rc::Rc};

#[matchbox_class]
#[derive( Debug )]
pub struct Counter { pub value: f64 }

#[matchbox_methods]
impl Counter {
	pub fn increment( &mut self ) -> f64 { self.value += 1.0; self.value }
	pub fn add( &mut self, n: f64 ) -> f64 { self.value += n; self.value }
	pub fn get( &self ) -> f64 { self.value }
}

pub fn create_counter( vm: &mut dyn BxVM, args: &[BxValue] ) -> Result<BxValue, String> {
	let initial = args.first().map( |v| v.as_number() ).unwrap_or( 0.0 );
	let id = vm.native_object_new( Rc::new( RefCell::new( Counter { value: initial } ) ) );
	Ok( BxValue::new_ptr( id ) )
}

pub fn register_classes() -> HashMap<String, BxNativeFunction> {
	let mut map = HashMap::new();
	// Key is "<file name without .rs>.<ClassName>"
	map.insert( "counter.Counter".to_string(), create_counter as BxNativeFunction );
	map
}
```

```js
c = new rust:counter.Counter( 0 );
c.increment();
c.add( 9 );
println( c.get() ); // 10
```

Method names are matched case-insensitively.

---

## Rust Calling Back Into BoxLang

A BIF receives the BoxLang function as a `BxValue`. Call it through the `BxVM` trait. This example was compiled and run against MatchBox 0.11.0.

```rust
// native/callbacks.rs
use matchbox_vm::types::{BxNativeFunction, BxValue, BxVM};
use std::collections::HashMap;

/// sum_calls( fn, count ): calls fn( 1 ) .. fn( count ) and returns the sum of the results.
pub fn sum_calls( vm: &mut dyn BxVM, args: &[BxValue] ) -> Result<BxValue, String> {
	if args.len() != 2 {
		return Err( "sum_calls: expected a function and a count".to_string() );
	}
	let chunk = vm.current_chunk().ok_or( "sum_calls: no active chunk" )?;
	let count = args[1].as_number() as i64;
	let mut total = 0.0;
	for n in 1..=count {
		let result = vm.call_function_by_value( &args[0], vec![ BxValue::new_number( n as f64 ) ], chunk.clone() )?;
		total += result.as_number();
	}
	Ok( BxValue::new_number( total ) )
}

pub fn register_bifs() -> HashMap<String, BxNativeFunction> {
	let mut map = HashMap::new();
	map.insert( "sum_calls".to_string(), sum_calls as BxNativeFunction );
	map
}
```

```js
// app.bxs
println( sum_calls( ( n ) => n * n, 4 ) ); // 30  (1 + 4 + 9 + 16)
```

Build and run with `matchbox --target native app.bxs && ./app`.

Useful `BxVM` methods: `current_chunk()`, `call_function_by_value( func, args, chunk )`, `call_method_by_value( receiver, name, args, chunk )`, `spawn_by_value( ... )`, `to_string( value )`, and array and struct helpers such as `array_new`, `array_push`, `struct_new`, `struct_set`. Errors are `Result<_, String>` and surface as BoxLang runtime errors.

---

## Extra Crates

Add `native/Cargo.toml`:

```toml
[package]
name    = "native"
version = "0.1.0"
edition = "2021"

[dependencies]
serde_json = "1"
```

MatchBox builds it as a normal Cargo project and links it in. This needs a Rust toolchain and network access for crates.

---

## Java From a Native Build (experimental)

Native builds also include an experimental JNI bridge: `sb = java.new( "java.lang.StringBuilder", "Hello" )`. It needs a JDK on the host at runtime, has no generics or annotations, and may change. Prefer Rust crates when you can.

---

## Checklist

- [ ] Build with `matchbox --target native app.bxs` and run the produced binary, not `matchbox app.bxs`
- [ ] Register the `_wrapper` that `#[matchbox_fn]` generates, not the plain function
- [ ] Use a manual BIF for string, null or object returns
- [ ] Class key format is `<module>.<Class>` and BoxLang uses `new rust:<module>.<Class>()`
- [ ] Keep BIF and class names unique across `native/*.rs`
- [ ] For callbacks, take `current_chunk()` once and pass it to `call_function_by_value`
- [ ] Do not use Native Fusion for js, wasm, wasi or esp32 targets
