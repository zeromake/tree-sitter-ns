#include <tree_sitter/parser.h>
#include <tree_sitter/api.h>

#include <filesystem>
#include <vector>
#include <functional>

extern "C" const TSLanguage * tree_sitter_ns();

#define var_defer__(x) defer__ ## x
#define var_defer_(x) var_defer__(x)
#define defer(ops) Defer var_defer_(__COUNTER__)(ops)
#define ref_defer(ops) Defer var_defer_(__COUNTER__)([&]{ ops; }) // Capture all by ref
#define val_defer(ops) Defer var_defer_(__COUNTER__)([=]{ ops; }) // Capture all by val
#define none_defer(ops) Defer var_defer_(__COUNTER__)([]{ ops; }) // Capture nothing

struct Defer {
    std::function<void(void)> action;
    Defer(const std::function<void(void)>& act);
    Defer(const std::function<void(void)>&& act);
    Defer(const Defer& act) = delete;
    Defer& operator=(const Defer& act) = delete;
    Defer(Defer&& act) = delete;
    Defer& operator=(Defer&& act) = delete;
    ~Defer();
};

Defer::Defer(const std::function<void(void)>& act): action(act) {};
Defer::Defer(const std::function<void(void)>&& act): action(std::move(act)) {};
Defer::~Defer() {
    action();
};

int main(const int argc, const char* argv[]) {
    TSParser* parser = ts_parser_new();
    defer([&parser]{
        ts_parser_delete(parser);
    });
    ts_parser_set_language(parser, tree_sitter_ns());
    const char *input = argv[1];
    auto file_size = std::filesystem::file_size(input);
    std::vector<char> data;
    data.resize(file_size);
    {
        auto fd = std::fopen(input, "rb");
        defer([&fd]{
            std::fclose(fd);
        });
        std::fread(data.data(), file_size, 1, fd);
        {
            auto tree = ts_parser_parse_string_encoding(parser, NULL, data.data(), file_size, TSInputEncodingUTF8);
            defer([&tree]{
                ts_tree_delete(tree);
            });
            auto root = ts_tree_root_node(tree);
            auto count = ts_node_child_count(root);
            for (int i = 0; i < count; i++) {
                auto child_node = ts_node_named_child(root, i);
                auto point1 = ts_node_start_point(child_node);
                auto point2 = ts_node_end_point(child_node);
                auto type = ts_node_type(child_node);
                printf("(%s [%d, %d] - [%d, %d])\n", type, point1.row+1, point1.column+1, point2.row+1, point2.column+1);
            }
        }
    }
    return 0;
}
