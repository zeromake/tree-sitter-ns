add_rules("mode.debug", "mode.release")

add_repositories("zeromake https://github.com/zeromake/xrepo.git")

add_requires("tree-sitter")

set_rundir("$(projectdir)")

target("tree-sitter-ns")
    add_includedirs("src")
    set_kind("static")
    add_files("src/parser.c")

target("parse")
    set_languages("c++17")
    add_packages("tree-sitter")
    add_files("tests/src/parse.cpp")
    add_deps("tree-sitter-ns")
